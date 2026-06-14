export interface Curation {
  /** Ordered product ids forced to the top of the results. */
  pinned: number[];
  /** Product ids removed from the results. */
  hidden: number[];
}

/** Normalize a query to its curation key, so "Sofa " and "sofa" share a rule. */
export function normalizeCurationQuery(q: string): string {
  return q.trim().toLowerCase();
}

/**
 * Apply a curation to a ranked id list (Step 9): drop hidden ids, force pinned
 * ids to the front in order (even ones BM25 never returned), dedupe the rest.
 * Pure, so it is unit-tested; the search path hydrates the resulting ids into
 * product cards. Hidden takes precedence over pinned.
 */
export function curateIds(rankedIds: number[], curation: Curation): number[] {
  const hidden = new Set(curation.hidden);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of curation.pinned) {
    if (!hidden.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of rankedIds) {
    if (!hidden.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}

/** True when a curation actually changes anything. */
export function curationActive(c: Curation | undefined): c is Curation {
  return !!c && (c.pinned.length > 0 || c.hidden.length > 0);
}
