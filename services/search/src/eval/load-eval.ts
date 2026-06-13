import { evalJudgments, evalQueries, type Db } from "@nordhem/db";
import { dedupeJudgments, type RawJudgment, type RawQuery } from "./wands.ts";

const BATCH_SIZE = 1_000;

/**
 * Truncate-and-reload the WANDS evaluation set (queries first, then judgments,
 * because a judgment references its query). One transaction, batched inserts
 * for the ~233k judgments. Returns how many of each were loaded.
 */
export async function loadEvalSet(
  db: Db,
  queries: RawQuery[],
  judgments: RawJudgment[],
): Promise<{ queries: number; judgments: number }> {
  // WANDS has duplicate (query, product) rows; collapse them to satisfy the
  // composite primary key.
  const deduped = dedupeJudgments(judgments);
  await db.transaction(async (tx) => {
    // Judgments reference queries, so clear children first, parents after.
    await tx.delete(evalJudgments);
    await tx.delete(evalQueries);
    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
      await tx.insert(evalQueries).values(queries.slice(i, i + BATCH_SIZE));
    }
    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      await tx.insert(evalJudgments).values(deduped.slice(i, i + BATCH_SIZE));
    }
  });
  return { queries: queries.length, judgments: deduped.length };
}
