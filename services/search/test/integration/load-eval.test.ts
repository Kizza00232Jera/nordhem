import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, ensureSchema, evalJudgments, evalQueries, type Db } from "@nordhem/db";
import { loadEvalSet } from "../../src/eval/load-eval.ts";
import { parseLabelsTsv, parseQueriesTsv } from "../../src/eval/wands.ts";

const QUERIES_TSV = [
  "query_id\tquery\tquery_class",
  "0\tsalon chair\tMassage Chairs",
  "1\tsmart coffee table\tCoffee & Cocktail Tables",
].join("\n");

const LABELS_TSV = [
  "id\tquery_id\tproduct_id\tlabel",
  "0\t0\t25434\tExact",
  "1\t0\t12088\tIrrelevant",
  "2\t1\t777\tPartial",
].join("\n");

let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
}, 240_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

describe("loadEvalSet into Postgres", () => {
  it("loads queries and judgments and maps labels to grades", async () => {
    const counts = await loadEvalSet(
      db,
      parseQueriesTsv(QUERIES_TSV),
      parseLabelsTsv(LABELS_TSV),
    );
    expect(counts).toEqual({ queries: 2, judgments: 3 });

    const queries = await db.select().from(evalQueries).orderBy(evalQueries.queryId);
    expect(queries[0]).toEqual({ queryId: 0, query: "salon chair", queryClass: "Massage Chairs" });

    const judgments = await db
      .select()
      .from(evalJudgments)
      .orderBy(evalJudgments.queryId, evalJudgments.productId);
    expect(judgments).toEqual([
      { queryId: 0, productId: 12088, grade: 0 },
      { queryId: 0, productId: 25434, grade: 2 },
      { queryId: 1, productId: 777, grade: 1 },
    ]);
  });

  it("is idempotent: reloading replaces instead of duplicating", async () => {
    await loadEvalSet(db, parseQueriesTsv(QUERIES_TSV), parseLabelsTsv(LABELS_TSV));
    expect(await db.select().from(evalJudgments)).toHaveLength(3);
    expect(await db.select().from(evalQueries)).toHaveLength(2);
  });
});
