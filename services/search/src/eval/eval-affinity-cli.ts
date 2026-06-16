import { createDb, ensureSchema, evalJudgments, evalQueries } from "@nordhem/db";
import { buildAffinityBoostMap, type ClickObservation } from "../analytics/affinity.ts";
import {
  DEFAULT_CLICK_MODEL,
  mulberry32,
  rankByGrade,
  simulateClickedPositions,
} from "../analytics/simulate.ts";
import { createEsClient } from "../es/client.ts";
import { buildSearchBody, type AffinityBoost } from "../search/query.ts";
import { runEval, type Judgment } from "./harness.ts";
import { saveEvalRun } from "./store.ts";

/**
 * Step 11a before/after: does the click-affinity boost move nDCG? With no live
 * traffic yet, we MANUFACTURE clicks from the WANDS judgments (the cascade
 * model: position-biased examination times a per-grade click probability),
 * aggregate them into boosts, and re-run the eval with the boost applied.
 *
 * This is deliberately CIRCULAR and we say so: the clicks were generated from
 * the same judgments the eval scores against, so the lift is an OPTIMISTIC upper
 * bound on what real clicks could do, not a production number. The honest value
 * is the mechanism end to end (clicks -> position-corrected affinity -> a capped
 * query-time boost -> a measurable ranking change) and the cap's behaviour.
 *
 * Both runs are saved, so the studio compare view shows them side by side.
 *
 *   pnpm -F @nordhem/search eval-affinity [--sessions 8] [--seed 11] [--sample N]
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";
const RETRIEVE = 100;

function numFlag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const sessions = numFlag("sessions", 8);
const seed = numFlag("seed", 11);
const sample = numFlag("sample", 0); // 0 = all queries
const decay = DEFAULT_CLICK_MODEL.decay;

const es = createEsClient(esUrl);
const { db, close } = createDb(databaseUrl);

try {
  await ensureSchema(db);
  const allQueries = await db.select().from(evalQueries).orderBy(evalQueries.queryId);
  const queries = sample > 0 ? allQueries.slice(0, sample) : allQueries;
  const judgmentRows = await db.select().from(evalJudgments);

  const judgmentsByQueryId = new Map<number, Judgment[]>();
  for (const row of judgmentRows) {
    const list = judgmentsByQueryId.get(row.queryId) ?? [];
    list.push({ productId: row.productId, grade: row.grade });
    judgmentsByQueryId.set(row.queryId, list);
  }

  // Manufacture clicks from the judgments with the cascade model.
  const rng = mulberry32(seed);
  const clicks: ClickObservation[] = [];
  for (const q of queries) {
    const ranked = rankByGrade(judgmentsByQueryId.get(q.queryId) ?? []);
    const grades = ranked.map((r) => r.grade);
    for (let s = 0; s < sessions; s++) {
      for (const pos of simulateClickedPositions(grades, rng)) {
        const hit = ranked[pos - 1];
        if (hit) clicks.push({ query: q.query, productId: hit.productId, position: pos });
      }
    }
  }
  const boostMap = buildAffinityBoostMap(clicks, { decay });
  const boostedQueries = [...boostMap.values()].filter((b) => b.length > 0).length;

  const makeSearch =
    (boosts?: Map<string, AffinityBoost[]>) =>
    async (text: string): Promise<number[]> => {
      const affinityBoosts = boosts?.get(text);
      const res = await es.search<unknown>({
        index,
        ...buildSearchBody(text, RETRIEVE, affinityBoosts?.length ? { affinityBoosts } : {}),
      });
      return res.hits.hits.map((h) => Number(h._id)).filter((id) => Number.isFinite(id));
    };

  console.log(
    `manufactured ${clicks.length} clicks over ${queries.length} queries ` +
      `(${sessions} sessions, seed ${seed}); ${boostedQueries} queries got a boost\n`,
  );

  const before = await runEval({ queries, judgmentsByQueryId, search: makeSearch() });
  const after = await runEval({ queries, judgmentsByQueryId, search: makeSearch(boostMap) });

  const cfg = { ndcgK: 10, recallK: 100, retrieve: RETRIEVE };
  const beforeId = await saveEvalRun(db, { label: "baseline (no affinity)", indexName: index, config: cfg }, before);
  const afterId = await saveEvalRun(
    db,
    { label: `learned affinity (synthetic, seed ${seed})`, indexName: index, config: { ...cfg, decay, sessions } },
    after,
  );

  const d = (a: number, b: number) => (b - a >= 0 ? "+" : "") + (b - a).toFixed(4);
  const pct = (n: number) => (n * 100).toFixed(1) + "%";
  console.log(`                before    after     delta`);
  console.log(`  nDCG@10       ${before.ndcg.toFixed(4)}    ${after.ndcg.toFixed(4)}    ${d(before.ndcg, after.ndcg)}`);
  console.log(`  MRR           ${before.mrr.toFixed(4)}    ${after.mrr.toFixed(4)}    ${d(before.mrr, after.mrr)}`);
  console.log(`  recall@100    ${pct(before.recall)}     ${pct(after.recall)}`);
  console.log(`\n  saved runs ${beforeId} (before) and ${afterId} (after)`);
  console.log(`  compare: /studio/relevance/compare?a=${beforeId}&b=${afterId}`);
  console.log(`\n  NOTE: clicks were synthesised from the judgments, so this lift is an`);
  console.log(`  optimistic upper bound, not a production number. It proves the loop works.`);
} finally {
  await close();
}
