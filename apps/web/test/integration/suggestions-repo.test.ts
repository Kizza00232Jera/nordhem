import { createDb, type Db, ensureSchema, searchSuggestion } from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createSuggestion,
  decideSuggestion,
  listSuggestions,
  suggestionCounts,
} from "../../lib/suggestions-repo";

// Step 11b: the suggestion approval queue against a real Postgres. The shape
// that matters is the status lifecycle (pending -> approved/rejected with a
// decidedAt stamp) and that pending/decided lists partition cleanly, so it runs
// on the real engine, not a mock.
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

beforeEach(async () => {
  await db.delete(searchSuggestion);
});

const couch = {
  query: "couch",
  kind: "oneway" as const,
  terms: "couch",
  mapsTo: "sofa",
  rationale: "shoppers searched 'couch' with poor results; the catalog says 'sofa'",
  source: "heuristic" as const,
};

describe("suggestions repo", () => {
  it("creates a pending suggestion and lists it", async () => {
    await createSuggestion(db, couch);
    const pending = await listSuggestions(db, "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      query: "couch",
      kind: "oneway",
      terms: "couch",
      mapsTo: "sofa",
      status: "pending",
      source: "heuristic",
    });
    expect(pending[0]!.decidedAt).toBeNull();
  });

  it("decideSuggestion stamps status + decidedAt and moves it between lists", async () => {
    const id = await createSuggestion(db, couch);
    const decided = await decideSuggestion(db, id, "approved");
    expect(decided?.status).toBe("approved");
    expect(decided?.decidedAt).toBeInstanceOf(Date);
    expect(await listSuggestions(db, "pending")).toHaveLength(0);
    expect(await listSuggestions(db, "approved")).toHaveLength(1);
  });

  it("suggestionCounts groups by status", async () => {
    await createSuggestion(db, couch);
    await createSuggestion(db, { ...couch, query: "settee", terms: "settee" });
    const id = await createSuggestion(db, { ...couch, query: "divan", terms: "divan" });
    await decideSuggestion(db, id, "rejected");

    const counts = await suggestionCounts(db);
    expect(counts.pending).toBe(2);
    expect(counts.rejected).toBe(1);
  });
});
