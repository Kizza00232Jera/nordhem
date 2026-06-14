import { createDb, ensureSchema, searchEvents, type Db } from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recordEvent, recordEvents } from "../../lib/events-repo";

// The events repo against a real Postgres. The interesting behaviour is the
// row derivation: a search row carries mode/resultCount/zeroResult and null
// click columns; a click row carries productId/position and null search
// columns; and the source label ('live' vs 'synthetic') is honest so the
// dashboards can exclude simulated traffic. All of that is database shape, so
// it is tested on the real engine, never mocked.
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
});

describe("recordEvent", () => {
  it("stores a search hit and derives zeroResult=false", async () => {
    await recordEvent(db, { type: "search", query: "sofa", mode: "hybrid", resultCount: 12, latencyMs: 40 });
    const rows = await db.select().from(searchEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "search",
      query: "sofa",
      mode: "hybrid",
      resultCount: 12,
      zeroResult: false,
      latencyMs: 40,
      source: "live",
      productId: null,
      position: null,
    });
  });

  it("derives zeroResult=true when a search returns nothing", async () => {
    await recordEvent(db, { type: "search", query: "xyzzy", mode: "lexical", resultCount: 0 });
    const [row] = await db.select().from(searchEvents);
    expect(row.zeroResult).toBe(true);
    expect(row.latencyMs).toBeNull();
  });

  it("stores a click with its position and null search columns", async () => {
    await recordEvent(db, { type: "click", query: "sofa", productId: 42, position: 3 });
    const [row] = await db.select().from(searchEvents);
    expect(row).toMatchObject({
      type: "click",
      query: "sofa",
      productId: 42,
      position: 3,
      source: "live",
      mode: null,
      resultCount: null,
      zeroResult: null,
    });
  });
});

describe("recordEvents", () => {
  it("labels a synthetic batch honestly", async () => {
    await recordEvents(
      db,
      [
        { type: "search", query: "rug", mode: "lexical", resultCount: 5 },
        { type: "click", query: "rug", productId: 7, position: 1 },
      ],
      "synthetic",
    );
    const rows = await db.select().from(searchEvents);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.source === "synthetic")).toBe(true);
  });

  it("is a no-op for an empty batch", async () => {
    await recordEvents(db, [], "synthetic");
    expect(await db.select().from(searchEvents)).toHaveLength(0);
  });
});
