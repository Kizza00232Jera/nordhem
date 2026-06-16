import { asc, clickAffinity, desc, eq, productImages, productsRaw } from "@nordhem/db";
import { db } from "./db";

/**
 * Step 11a learning loop, studio read side. Shows the editor what the click
 * feedback has learned: per query, which products people click and the capped
 * boost that earns them at search time. Read-only — the boosts are produced by
 * the `aggregate-clicks` job, not edited here.
 */

/** Mirrors the search service's DEFAULT_AFFINITY_BOOST so the studio shows the
 * exact weight the query will apply. Kept in lockstep by these comments. */
const BOOST = { scale: 6, cap: 8 };

/** A normalised affinity (0,1] turned into the capped additive boost weight. */
export function boostWeight(affinity: number): number {
  if (!(affinity > 0)) return 0;
  return Math.min(affinity * BOOST.scale, BOOST.cap);
}

/** One click_affinity row joined to its product name + thumb (null if unknown). */
export interface AffinityRowRaw {
  query: string;
  productId: number;
  name: string | null;
  imageThumbUrl: string | null;
  observations: number;
  affinity: number;
  source: string;
}

export interface AffinityEntry {
  productId: number;
  name: string;
  imageThumbUrl: string | null;
  observations: number;
  affinity: number;
  boost: number;
}

export interface QueryAffinities {
  query: string;
  source: string;
  entries: AffinityEntry[];
}

/**
 * Group raw rows by query (input already ordered query asc, affinity desc),
 * attaching each product's display name and boost. Pure for unit testing.
 */
export function toQueryAffinities(rows: AffinityRowRaw[]): QueryAffinities[] {
  const groups: QueryAffinities[] = [];
  for (const r of rows) {
    let group = groups.at(-1);
    if (!group || group.query !== r.query) {
      group = { query: r.query, source: r.source, entries: [] };
      groups.push(group);
    }
    group.entries.push({
      productId: r.productId,
      name: r.name ?? `#${r.productId}`,
      imageThumbUrl: r.imageThumbUrl,
      observations: r.observations,
      affinity: r.affinity,
      boost: boostWeight(r.affinity),
    });
  }
  return groups;
}

/** Load the learned affinities for a source, grouped by query for the studio. */
export async function listAffinities(source = "live"): Promise<QueryAffinities[]> {
  const rows = await db()
    .select({
      query: clickAffinity.query,
      productId: clickAffinity.productId,
      name: productsRaw.name,
      imageThumbUrl: productImages.thumbUrl,
      observations: clickAffinity.observations,
      affinity: clickAffinity.affinity,
      source: clickAffinity.source,
    })
    .from(clickAffinity)
    .leftJoin(productsRaw, eq(clickAffinity.productId, productsRaw.productId))
    .leftJoin(productImages, eq(clickAffinity.productId, productImages.productId))
    .where(eq(clickAffinity.source, source))
    .orderBy(asc(clickAffinity.query), desc(clickAffinity.affinity));
  return toQueryAffinities(rows);
}

/** Per-source counts for the page header (and to spot an empty table). */
export async function affinityCounts(): Promise<Record<string, number>> {
  const rows = await db().select({ source: clickAffinity.source }).from(clickAffinity);
  const counts: Record<string, number> = { live: 0, synthetic: 0 };
  for (const r of rows) counts[r.source] = (counts[r.source] ?? 0) + 1;
  return counts;
}
