import { createDb, ensureSchema, evalJudgments, evalQueries } from "@nordhem/db";
import { createEsClient } from "../es/client.ts";
import { embedQuery } from "../embed/embed.ts";
import { hybridProductIds, knnProductIds, lexicalProductIds } from "../search/semantic.ts";
import { runEval, type EvalResult, type Judgment } from "./harness.ts";
import { rescueAnalysis } from "./rescue.ts";
import { saveEvalRun } from "./store.ts";

// The headline Step 8 benchmark: score lexical vs semantic vs hybrid over the
// full judged query set against the embedded benchmark index, save each as a
// run, and report how many total-miss queries semantic/hybrid rescue.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";
const RETRIEVE = 100; // depth: enough for recall@100
const NUM_CANDIDATES = 200; // kNN candidate depth (recall/speed dial)

const es = createEsClient(esUrl);
const { db, close } = createDb(databaseUrl);
const pct = (n: number) => (n * 100).toFixed(1) + "%";

try {
  await ensureSchema(db);
  const queries = await db.select().from(evalQueries).orderBy(evalQueries.queryId);
  const judgmentRows = await db.select().from(evalJudgments);
  const judgmentsByQueryId = new Map<number, Judgment[]>();
  for (const row of judgmentRows) {
    const list = judgmentsByQueryId.get(row.queryId) ?? [];
    list.push({ productId: row.productId, grade: row.grade });
    judgmentsByQueryId.set(row.queryId, list);
  }

  async function evalMode(
    mode: string,
    search: (text: string) => Promise<number[]>,
  ): Promise<EvalResult> {
    const started = Date.now();
    const result = await runEval({ queries, judgmentsByQueryId, search });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    await saveEvalRun(
      db,
      {
        label: `${mode} (step 8)`,
        indexName: index,
        config: { mode, ndcgK: 10, recallK: 100, retrieve: RETRIEVE, numCandidates: NUM_CANDIDATES },
      },
      result,
    );
    console.log(`\n${mode}  (${result.queryCount} queries, ${secs}s)`);
    console.log(`  nDCG@10    ${result.ndcg.toFixed(4)}`);
    console.log(`  MRR        ${result.mrr.toFixed(4)}`);
    console.log(`  recall@100 ${pct(result.recall)}`);
    return result;
  }

  const lexical = await evalMode("lexical", (q) => lexicalProductIds(es, index, q, RETRIEVE));
  const semantic = await evalMode("semantic", async (q) =>
    knnProductIds(es, index, await embedQuery(q), { k: RETRIEVE, numCandidates: NUM_CANDIDATES }),
  );
  const hybrid = await evalMode("hybrid", (q) =>
    hybridProductIds(es, index, q, { k: RETRIEVE, numCandidates: NUM_CANDIDATES }),
  );

  console.log(`\nZero-result rescue vs lexical (a query lexical scored 0 on, the mode saved):`);
  for (const [name, result] of [["semantic", semantic], ["hybrid", hybrid]] as const) {
    const nd = rescueAnalysis(lexical.perQuery, result.perQuery);
    const rc = rescueAnalysis(lexical.perQuery, result.perQuery, (s) => s.recall);
    console.log(
      `  ${name}: nDCG rescued ${nd.rescued}, regressed ${nd.regressed}, still-zero ${nd.bothZero} of ${nd.total}` +
        `  |  recall rescued ${rc.rescued}, regressed ${rc.regressed}`,
    );
  }
} finally {
  await close();
}
