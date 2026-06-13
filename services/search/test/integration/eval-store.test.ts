import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, ensureSchema, eq, evalQueryScores, evalRuns, type Db } from "@nordhem/db";
import { saveEvalRun } from "../../src/eval/store.ts";
import type { EvalResult } from "../../src/eval/harness.ts";

let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

const RESULT: EvalResult = {
  queryCount: 2,
  ndcg: 0.5,
  mrr: 0.75,
  recall: 0.25,
  perQuery: [
    { queryId: 0, query: "chair", ndcg: 1, rr: 1, recall: 0.5 },
    { queryId: 1, query: "table", ndcg: 0, rr: 0.5, recall: 0 },
  ],
};

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
}, 240_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

describe("saveEvalRun", () => {
  it("persists the aggregate run and its per-query scores", async () => {
    const runId = await saveEvalRun(
      db,
      { label: "baseline", indexName: "products", config: { ndcgK: 10, recallK: 100 } },
      RESULT,
    );
    expect(typeof runId).toBe("string");

    const [run] = await db.select().from(evalRuns).where(eq(evalRuns.id, runId));
    expect(run).toMatchObject({
      label: "baseline",
      indexName: "products",
      queryCount: 2,
      ndcg: 0.5,
      mrr: 0.75,
      recall: 0.25,
      config: { ndcgK: 10, recallK: 100 },
    });

    const scores = await db
      .select()
      .from(evalQueryScores)
      .where(eq(evalQueryScores.runId, runId))
      .orderBy(evalQueryScores.queryId);
    expect(scores).toEqual([
      { runId, queryId: 0, ndcg: 1, rr: 1, recall: 0.5 },
      { runId, queryId: 1, ndcg: 0, rr: 0.5, recall: 0 },
    ]);
  });
});
