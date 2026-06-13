import { evalQueryScores, evalRuns, type Db } from "@nordhem/db";
import type { EvalResult } from "./harness.ts";

const BATCH_SIZE = 1_000;

export interface RunMeta {
  label: string;
  indexName: string;
  config: Record<string, unknown>;
}

/**
 * Persist an evaluation run and its per-query scores in one transaction, so a
 * run is always all-or-nothing and the studio can compare runs over time.
 * Returns the new run id.
 */
export async function saveEvalRun(
  db: Db,
  meta: RunMeta,
  result: EvalResult,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(evalRuns)
      .values({
        label: meta.label,
        indexName: meta.indexName,
        queryCount: result.queryCount,
        ndcg: result.ndcg,
        mrr: result.mrr,
        recall: result.recall,
        config: meta.config,
      })
      .returning({ id: evalRuns.id });
    if (!run) throw new Error("eval_runs insert returned no row");

    const scores = result.perQuery.map((q) => ({
      runId: run.id,
      queryId: q.queryId,
      ndcg: q.ndcg,
      rr: q.rr,
      recall: q.recall,
    }));
    for (let i = 0; i < scores.length; i += BATCH_SIZE) {
      await tx.insert(evalQueryScores).values(scores.slice(i, i + BATCH_SIZE));
    }
    return run.id;
  });
}
