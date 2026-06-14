import { and, count, eq, isNotNull, searchEvents, sql, type Db } from "@nordhem/db";

/**
 * Search analytics aggregations over the first-party search_events table (Step
 * 10). The dashboards read these. The SQL stays simple (filtered counts and a
 * result-count distribution); the position-bias CTR math is a pure function so
 * it can be unit-tested without a database.
 */

/** 'all' shows live + synthetic traffic together; the dashboard labels both. */
export type SourceFilter = "live" | "synthetic" | "all";

export interface QueryStat {
  query: string;
  searches: number;
  zeroResults: number;
}

export interface ZeroResultStat {
  query: string;
  searches: number;
}

export interface PositionCtr {
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface LatencyStats {
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

export interface AnalyticsSummary {
  totalSearches: number;
  totalClicks: number;
  distinctQueries: number;
  zeroResultRate: number;
  liveSearches: number;
  syntheticSearches: number;
}

/** undefined when 'all' so drizzle's and() drops it. */
function sourceWhere(source: SourceFilter) {
  return source === "all" ? undefined : eq(searchEvents.source, source);
}

/** The most-searched queries, each with how many of those searches found nothing. */
export async function topQueries(db: Db, limit = 10, source: SourceFilter = "all"): Promise<QueryStat[]> {
  const rows = await db
    .select({
      query: searchEvents.query,
      searches: count(),
      zeroResults: sql<number>`count(*) filter (where ${searchEvents.zeroResult})::int`,
    })
    .from(searchEvents)
    .where(and(eq(searchEvents.type, "search"), sourceWhere(source)))
    .groupBy(searchEvents.query)
    .orderBy(sql`count(*) desc`, searchEvents.query)
    .limit(limit);
  return rows.map((r) => ({
    query: r.query,
    searches: Number(r.searches),
    zeroResults: Number(r.zeroResults),
  }));
}

/** The overall zero-result rate: zero-result searches over all searches. */
export async function zeroResultRate(
  db: Db,
  source: SourceFilter = "all",
): Promise<{ searches: number; zero: number; rate: number }> {
  const [row] = await db
    .select({
      searches: count(),
      zero: sql<number>`count(*) filter (where ${searchEvents.zeroResult})::int`,
    })
    .from(searchEvents)
    .where(and(eq(searchEvents.type, "search"), sourceWhere(source)));
  const searches = Number(row?.searches ?? 0);
  const zero = Number(row?.zero ?? 0);
  return { searches, zero, rate: searches > 0 ? zero / searches : 0 };
}

/** The queries that most often return nothing (the editor's fix-it backlog). */
export async function zeroResultQueries(
  db: Db,
  limit = 10,
  source: SourceFilter = "all",
): Promise<ZeroResultStat[]> {
  const rows = await db
    .select({ query: searchEvents.query, searches: count() })
    .from(searchEvents)
    .where(and(eq(searchEvents.type, "search"), eq(searchEvents.zeroResult, true), sourceWhere(source)))
    .groupBy(searchEvents.query)
    .orderBy(sql`count(*) desc`, searchEvents.query)
    .limit(limit);
  return rows.map((r) => ({ query: r.query, searches: Number(r.searches) }));
}

/**
 * Pure CTR-by-position math. impressions(p) = the number of searches that
 * returned at least p results (so a result at rank p was actually shown);
 * ctr(p) = clicks(p) / impressions(p), guarded against divide-by-zero.
 */
export function ctrByPositionFrom(
  distribution: { resultCount: number; n: number }[],
  clicks: Map<number, number> | Record<number, number>,
  maxPosition = 10,
): PositionCtr[] {
  const clicksAt = (p: number) =>
    clicks instanceof Map ? clicks.get(p) ?? 0 : clicks[p] ?? 0;
  const out: PositionCtr[] = [];
  for (let position = 1; position <= maxPosition; position++) {
    const impressions = distribution.reduce(
      (sum, d) => sum + (d.resultCount >= position ? d.n : 0),
      0,
    );
    const c = clicksAt(position);
    out.push({ position, impressions, clicks: c, ctr: impressions > 0 ? c / impressions : 0 });
  }
  return out;
}

async function resultCountDistribution(
  db: Db,
  source: SourceFilter,
): Promise<{ resultCount: number; n: number }[]> {
  const rows = await db
    .select({ resultCount: searchEvents.resultCount, n: count() })
    .from(searchEvents)
    .where(
      and(eq(searchEvents.type, "search"), isNotNull(searchEvents.resultCount), sourceWhere(source)),
    )
    .groupBy(searchEvents.resultCount);
  return rows.map((r) => ({ resultCount: Number(r.resultCount), n: Number(r.n) }));
}

async function clicksByPosition(db: Db, source: SourceFilter): Promise<Map<number, number>> {
  const rows = await db
    .select({ position: searchEvents.position, n: count() })
    .from(searchEvents)
    .where(
      and(eq(searchEvents.type, "click"), isNotNull(searchEvents.position), sourceWhere(source)),
    )
    .groupBy(searchEvents.position);
  return new Map(rows.map((r) => [Number(r.position), Number(r.n)]));
}

/** CTR for positions 1..maxPosition, over real impressions and clicks. */
export async function ctrByPosition(
  db: Db,
  maxPosition = 10,
  source: SourceFilter = "all",
): Promise<PositionCtr[]> {
  const [distribution, clicks] = await Promise.all([
    resultCountDistribution(db, source),
    clicksByPosition(db, source),
  ]);
  return ctrByPositionFrom(distribution, clicks, maxPosition);
}

/** Latency percentiles over recorded search latencies. */
export async function latencyPercentiles(db: Db, source: SourceFilter = "all"): Promise<LatencyStats> {
  const [row] = await db
    .select({
      p50: sql<number | null>`percentile_cont(0.5) within group (order by ${searchEvents.latencyMs})`,
      p95: sql<number | null>`percentile_cont(0.95) within group (order by ${searchEvents.latencyMs})`,
      p99: sql<number | null>`percentile_cont(0.99) within group (order by ${searchEvents.latencyMs})`,
    })
    .from(searchEvents)
    .where(
      and(eq(searchEvents.type, "search"), isNotNull(searchEvents.latencyMs), sourceWhere(source)),
    );
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return { p50: num(row?.p50), p95: num(row?.p95), p99: num(row?.p99) };
}

/** Headline totals for the dashboard, including the live/synthetic split. */
export async function analyticsSummary(db: Db): Promise<AnalyticsSummary> {
  const [row] = await db
    .select({
      totalSearches: sql<number>`count(*) filter (where ${searchEvents.type} = 'search')::int`,
      totalClicks: sql<number>`count(*) filter (where ${searchEvents.type} = 'click')::int`,
      distinctQueries: sql<number>`count(distinct ${searchEvents.query})::int`,
      zero: sql<number>`count(*) filter (where ${searchEvents.type} = 'search' and ${searchEvents.zeroResult})::int`,
      liveSearches: sql<number>`count(*) filter (where ${searchEvents.type} = 'search' and ${searchEvents.source} = 'live')::int`,
      syntheticSearches: sql<number>`count(*) filter (where ${searchEvents.type} = 'search' and ${searchEvents.source} = 'synthetic')::int`,
    })
    .from(searchEvents);
  const totalSearches = Number(row?.totalSearches ?? 0);
  const zero = Number(row?.zero ?? 0);
  return {
    totalSearches,
    totalClicks: Number(row?.totalClicks ?? 0),
    distinctQueries: Number(row?.distinctQueries ?? 0),
    zeroResultRate: totalSearches > 0 ? zero / totalSearches : 0,
    liveSearches: Number(row?.liveSearches ?? 0),
    syntheticSearches: Number(row?.syntheticSearches ?? 0),
  };
}
