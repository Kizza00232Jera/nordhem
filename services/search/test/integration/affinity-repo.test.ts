import { clickAffinity, createDb, type Db, ensureSchema, searchEvents } from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aggregateAffinities } from "../../src/analytics/affinity.ts";
import {
  loadAffinityBoosts,
  readClickObservations,
  replaceAffinities,
} from "../../src/analytics/affinity-repo.ts";

// The learning loop against a real Postgres. The whole point is the round trip
// from logged clicks to a query-time boost, so it runs end to end on the real
// engine: read clicks -> position-bias aggregate -> replace the table -> load
// capped boosts. DB shape (normalisation, source isolation, the (query,product)
// key) cannot be honestly tested against a mock.
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
  await db.delete(searchEvents);
  await db.delete(clickAffinity);
});

describe("readClickObservations", () => {
  it("reads only real clicks of the given source, normalising the query", async () => {
    await db.insert(searchEvents).values([
      // a live click on a mixed-case, padded query -> normalised to "oak bed"
      { type: "click", query: "Oak Bed ", productId: 100, position: 1, source: "live" },
      // a synthetic click -> excluded from the live stream
      { type: "click", query: "oak bed", productId: 200, position: 3, source: "synthetic" },
      // a search row -> not a click, excluded
      { type: "search", query: "oak bed", mode: "hybrid", resultCount: 5, zeroResult: false, source: "live" },
    ]);

    const obs = await readClickObservations(db, "live");
    expect(obs).toEqual([{ query: "oak bed", productId: 100, position: 1 }]);
  });
});

describe("aggregate -> replace -> load round trip", () => {
  it("turns logged clicks into capped per-product boosts", async () => {
    // Two shallow clicks on 100, one deep click on 200 (same hand-computed
    // fixture as the unit test): with decay 0.5 the deep click wins.
    await db.insert(searchEvents).values([
      { type: "click", query: "oak bed", productId: 100, position: 1, source: "live" },
      { type: "click", query: "oak bed", productId: 100, position: 1, source: "live" },
      { type: "click", query: "oak bed", productId: 200, position: 3, source: "live" },
    ]);

    const obs = await readClickObservations(db, "live");
    const written = await replaceAffinities(db, aggregateAffinities(obs, { decay: 0.5 }), "live");
    expect(written).toBe(2);

    const boosts = await loadAffinityBoosts(db, "Oak Bed", { boost: { scale: 6, cap: 8 } });
    const byProduct = new Map(boosts.map((b) => [b.productId, b.weight]));
    // 200: affinity 1.0 -> weight 6; 100: affinity 0.5 -> weight 3.
    expect(byProduct.get(200)).toBe(6);
    expect(byProduct.get(100)).toBe(3);
  });

  it("replaces the previous run and leaves other sources untouched", async () => {
    await replaceAffinities(
      db,
      [{ query: "sofa", productId: 9, observations: 1, rawScore: 1, affinity: 1 }],
      "synthetic",
    );
    // first live run
    await replaceAffinities(
      db,
      [{ query: "sofa", productId: 1, observations: 1, rawScore: 1, affinity: 1 }],
      "live",
    );
    // second live run replaces the first
    await replaceAffinities(
      db,
      [{ query: "sofa", productId: 2, observations: 1, rawScore: 1, affinity: 1 }],
      "live",
    );

    const live = await loadAffinityBoosts(db, "sofa", { source: "live" });
    expect(live.map((b) => b.productId)).toEqual([2]);
    // the synthetic row survived the live replace
    const synthetic = await loadAffinityBoosts(db, "sofa", { source: "synthetic" });
    expect(synthetic.map((b) => b.productId)).toEqual([9]);
  });
});
