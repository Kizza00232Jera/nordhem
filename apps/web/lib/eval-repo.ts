import {
  asc,
  desc,
  eq,
  evalQueries,
  evalQueryScores,
  evalRuns,
} from "@nordhem/db";
import { db } from "./db";

export interface RunSummary {
  id: string;
  label: string;
  indexName: string;
  queryCount: number;
  ndcg: number;
  mrr: number;
  recall: number;
  createdAt: Date;
}

export interface QueryScoreRow {
  queryId: number;
  query: string;
  ndcg: number;
  rr: number;
  recall: number;
}

export interface RunDetail extends RunSummary {
  config: unknown;
  scores: QueryScoreRow[];
}

const summaryColumns = {
  id: evalRuns.id,
  label: evalRuns.label,
  indexName: evalRuns.indexName,
  queryCount: evalRuns.queryCount,
  ndcg: evalRuns.ndcg,
  mrr: evalRuns.mrr,
  recall: evalRuns.recall,
  createdAt: evalRuns.createdAt,
};

/** All runs, newest first, for the lab dashboard. */
export async function listRuns(): Promise<RunSummary[]> {
  return db().select(summaryColumns).from(evalRuns).orderBy(desc(evalRuns.createdAt));
}

/**
 * One run with every per-query score, each joined to its query text and
 * ordered worst-nDCG first (the worst-queries table reads off the top). Null
 * if the run id is unknown.
 */
export async function getRun(runId: string): Promise<RunDetail | null> {
  const [run] = await db()
    .select({ ...summaryColumns, config: evalRuns.config })
    .from(evalRuns)
    .where(eq(evalRuns.id, runId));
  if (!run) return null;

  const scores = await db()
    .select({
      queryId: evalQueryScores.queryId,
      query: evalQueries.query,
      ndcg: evalQueryScores.ndcg,
      rr: evalQueryScores.rr,
      recall: evalQueryScores.recall,
    })
    .from(evalQueryScores)
    .innerJoin(evalQueries, eq(evalQueries.queryId, evalQueryScores.queryId))
    .where(eq(evalQueryScores.runId, runId))
    .orderBy(asc(evalQueryScores.ndcg), asc(evalQueryScores.queryId));

  return { ...run, scores };
}
