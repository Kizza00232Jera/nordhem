import { createDb, evalJudgments, evalQueries } from "@nordhem/db";
import { createEsClient } from "../es/client.ts";
import { buildSearchBody, type RankingConfig } from "../search/query.ts";
import { runEval, trainTestSplit, type Judgment } from "./harness.ts";
import { RANKING_CANDIDATES } from "./configs.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";
const RETRIEVE = 100;
// "test" confirms a winner on held-out queries; default sweeps on train.
const split = process.argv[2] === "test" ? "test" : "train";

const es = createEsClient(esUrl);
const { db, close } = createDb(databaseUrl);

function searchWith(config: RankingConfig) {
  return async (text: string): Promise<number[]> => {
    const res = await es.search<unknown>({
      index,
      ...buildSearchBody(text, RETRIEVE, { ranking: config }),
    });
    return res.hits.hits.map((h) => Number(h._id)).filter((id) => Number.isFinite(id));
  };
}

try {
  const allQueries = await db.select().from(evalQueries).orderBy(evalQueries.queryId);
  const judgmentRows = await db.select().from(evalJudgments);
  const judgmentsByQueryId = new Map<number, Judgment[]>();
  for (const row of judgmentRows) {
    const list = judgmentsByQueryId.get(row.queryId) ?? [];
    list.push({ productId: row.productId, grade: row.grade });
    judgmentsByQueryId.set(row.queryId, list);
  }

  const { train, test } = trainTestSplit(allQueries.map((q) => q.queryId));
  const keep = new Set(split === "test" ? test : train);
  const queries = allQueries.filter((q) => keep.has(q.queryId));
  console.log(`\nTuning sweep on the ${split} split (${queries.length} queries)\n`);

  let baseline = 0;
  for (const { name, config } of RANKING_CANDIDATES) {
    const started = Date.now();
    const r = await runEval({ queries, judgmentsByQueryId, search: searchWith(config) });
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    if (name.startsWith("baseline")) baseline = r.ndcg;
    const delta = baseline ? r.ndcg - baseline : 0;
    const sign = delta > 0 ? "+" : "";
    console.log(
      `${name.padEnd(34)} nDCG@10 ${r.ndcg.toFixed(4)} (${sign}${delta.toFixed(4)})  ` +
        `MRR ${r.mrr.toFixed(4)}  recall@100 ${(r.recall * 100).toFixed(1)}%  [${secs}s]`,
    );
  }
} finally {
  await close();
}
