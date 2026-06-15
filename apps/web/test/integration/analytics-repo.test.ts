import { createDb, ensureSchema, searchEvents, type Db } from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recordEvent, recordEvents } from "../../lib/events-repo";
import {
  analyticsSummary,
  ctrByPosition,
  latencyPercentiles,
  topQueries,
  zeroResultQueries,
  zeroResultRate,
} from "../../lib/analytics-repo";

// The analytics aggregations against a real Postgres. The SQL (filtered counts,
// percentile_cont, the result-count distribution that feeds CTR) is the thing
// under test, so it runs on the real engine over a known fixture of events.
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
  // 3 "sofa" searches (10 hits each), 2 "rug" (5 hits), 2 "zzz" (0 hits),
  // 1 synthetic "synthtest" (3 hits, no latency).
  await recordEvent(db, { type: "search", query: "sofa", mode: "hybrid", resultCount: 10, latencyMs: 10 });
  await recordEvent(db, { type: "search", query: "sofa", mode: "hybrid", resultCount: 10, latencyMs: 20 });
  await recordEvent(db, { type: "search", query: "sofa", mode: "hybrid", resultCount: 10, latencyMs: 30 });
  await recordEvent(db, { type: "search", query: "rug", mode: "lexical", resultCount: 5, latencyMs: 40 });
  await recordEvent(db, { type: "search", query: "rug", mode: "lexical", resultCount: 5, latencyMs: 50 });
  await recordEvent(db, { type: "search", query: "zzz", mode: "lexical", resultCount: 0, latencyMs: 5 });
  await recordEvent(db, { type: "search", query: "zzz", mode: "lexical", resultCount: 0, latencyMs: 5 });
  await recordEvents(db, [{ type: "search", query: "synthtest", mode: "hybrid", resultCount: 3 }], "synthetic");
  // Clicks: sofa@1 x2, sofa@2 x1, rug@1 x1 (4 clicks total).
  await recordEvent(db, { type: "click", query: "sofa", productId: 1, position: 1 });
  await recordEvent(db, { type: "click", query: "sofa", productId: 2, position: 1 });
  await recordEvent(db, { type: "click", query: "sofa", productId: 3, position: 2 });
  await recordEvent(db, { type: "click", query: "rug", productId: 9, position: 1 });
});

describe("topQueries", () => {
  it("ranks queries by search volume with their zero-result counts", async () => {
    const rows = await topQueries(db, 10);
    expect(rows[0]).toEqual({ query: "sofa", searches: 3, zeroResults: 0 });
    const zzz = rows.find((r) => r.query === "zzz");
    expect(zzz).toEqual({ query: "zzz", searches: 2, zeroResults: 2 });
  });
});

describe("zeroResultRate", () => {
  it("is zero-result searches over all searches", async () => {
    const { searches, zero, rate } = await zeroResultRate(db);
    expect(searches).toBe(8);
    expect(zero).toBe(2);
    expect(rate).toBeCloseTo(0.25, 5);
  });
});

describe("zeroResultQueries", () => {
  it("lists only the queries that returned nothing", async () => {
    expect(await zeroResultQueries(db, 10)).toEqual([{ query: "zzz", searches: 2 }]);
  });
});

describe("ctrByPosition", () => {
  it("computes CTR per position over real impressions", async () => {
    const ctr = await ctrByPosition(db, 3);
    // impressions(p) for p<=3 = searches with resultCount>=p = sofa(3)+rug(2)+synth(1) = 6.
    expect(ctr[0]).toEqual({ position: 1, impressions: 6, clicks: 3, ctr: 0.5 });
    expect(ctr[1]).toEqual({ position: 2, impressions: 6, clicks: 1, ctr: 1 / 6 });
    expect(ctr[2]).toEqual({ position: 3, impressions: 6, clicks: 0, ctr: 0 });
  });
});

describe("latencyPercentiles", () => {
  it("computes the median latency over recorded searches", async () => {
    const { p50, p95 } = await latencyPercentiles(db);
    // latencies = [5,5,10,20,30,40,50] -> median 20.
    expect(p50).toBe(20);
    expect(p95).not.toBeNull();
    expect(p95 as number).toBeGreaterThanOrEqual(p50 as number);
  });
});

describe("analyticsSummary", () => {
  it("totals searches, clicks, distinct queries and the live/synthetic split", async () => {
    const s = await analyticsSummary(db);
    expect(s.totalSearches).toBe(8);
    expect(s.totalClicks).toBe(4);
    expect(s.distinctQueries).toBe(4); // sofa, rug, zzz, synthtest
    expect(s.zeroResultRate).toBeCloseTo(0.25, 5);
    expect(s.liveSearches).toBe(7);
    expect(s.syntheticSearches).toBe(1);
  });
});
