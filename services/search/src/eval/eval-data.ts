import { evalJudgments, evalQueries, type Db } from "@nordhem/db";
import type { Judgment } from "./harness.ts";

export interface EvalData {
  queries: { queryId: number; query: string }[];
  judgmentsByQueryId: Map<number, Judgment[]>;
}

/** Load the whole eval set (queries + judgments grouped by query) from Postgres. */
export async function loadEvalData(db: Db): Promise<EvalData> {
  const queries = await db
    .select({ queryId: evalQueries.queryId, query: evalQueries.query })
    .from(evalQueries)
    .orderBy(evalQueries.queryId);
  const rows = await db.select().from(evalJudgments);
  const judgmentsByQueryId = new Map<number, Judgment[]>();
  for (const r of rows) {
    const list = judgmentsByQueryId.get(r.queryId) ?? [];
    list.push({ productId: r.productId, grade: r.grade });
    judgmentsByQueryId.set(r.queryId, list);
  }
  return { queries, judgmentsByQueryId };
}

/**
 * A lazy, once-only loader: the ~231k judgments are reference data that never
 * change during a server's life, so the tuning endpoint loads them on the
 * first eval and reuses the in-memory map for every slider tweak after.
 */
export function makeEvalDataCache(db: Db): () => Promise<EvalData> {
  let cached: Promise<EvalData> | null = null;
  return () => (cached ??= loadEvalData(db));
}
