import { and, clickAffinity, type Db, eq, searchEvents } from "@nordhem/db";
import { normalizeCurationQuery } from "../search/curate.ts";
import type { AffinityBoost } from "../search/query.ts";
import {
  affinityBoostWeight,
  type AffinityBoostParams,
  type AffinityRow,
  type ClickObservation,
  DEFAULT_AFFINITY_BOOST,
} from "./affinity.ts";

/** Which telemetry stream a learning run draws from. */
export type EventSource = "live" | "synthetic";

/**
 * Read click observations from the first-party telemetry log (Step 10's
 * search_events), keyed by the normalised query so "Oak Bed" and "oak bed "
 * share a signal. Only real clicks of one source — search rows are skipped,
 * and a malformed click missing product/position is dropped defensively.
 */
export async function readClickObservations(
  db: Db,
  source: EventSource = "live",
): Promise<ClickObservation[]> {
  const rows = await db
    .select({
      query: searchEvents.query,
      productId: searchEvents.productId,
      position: searchEvents.position,
      createdAt: searchEvents.createdAt,
    })
    .from(searchEvents)
    .where(and(eq(searchEvents.type, "click"), eq(searchEvents.source, source)));

  return rows
    .filter(
      (r): r is { query: string; productId: number; position: number; createdAt: Date } =>
        r.productId != null && r.position != null,
    )
    .map((r) => ({
      query: normalizeCurationQuery(r.query),
      productId: r.productId,
      position: r.position,
      at: r.createdAt.getTime(),
    }));
}

/**
 * Replace every affinity for a source with a freshly computed set, in one
 * transaction (delete-then-insert), so a partial run never leaves the table in
 * a mixed old/new state. A different source's rows are untouched, keeping a
 * live-derived loop and a synthetic demo independent. Returns rows written.
 */
export async function replaceAffinities(
  db: Db,
  rows: AffinityRow[],
  source: EventSource = "live",
): Promise<number> {
  await db.transaction(async (tx) => {
    await tx.delete(clickAffinity).where(eq(clickAffinity.source, source));
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000).map((r) => ({
        query: r.query,
        productId: r.productId,
        observations: r.observations,
        rawScore: r.rawScore,
        affinity: r.affinity,
        source,
      }));
      if (batch.length) await tx.insert(clickAffinity).values(batch);
    }
  });
  return rows.length;
}

/**
 * Load the capped affinity boosts for one query — read on every shop search,
 * the same per-request shape as loadCuration. Each stored affinity is turned
 * into an additive function_score weight; zero-weight entries are dropped.
 */
export async function loadAffinityBoosts(
  db: Db,
  query: string,
  opts: { source?: EventSource; boost?: AffinityBoostParams } = {},
): Promise<AffinityBoost[]> {
  const rows = await db
    .select({ productId: clickAffinity.productId, affinity: clickAffinity.affinity })
    .from(clickAffinity)
    .where(
      and(
        eq(clickAffinity.query, normalizeCurationQuery(query)),
        eq(clickAffinity.source, opts.source ?? "live"),
      ),
    );

  const boost = opts.boost ?? DEFAULT_AFFINITY_BOOST;
  return rows
    .map((r) => ({ productId: r.productId, weight: affinityBoostWeight(r.affinity, boost) }))
    .filter((b) => b.weight > 0);
}
