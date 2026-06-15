import type { SearchEventInput } from "@nordhem/shared";

/**
 * Judgment-driven simulated traffic (Step 10 slice 4). A cascade-flavoured click
 * model: a result at rank p is examined with a geometrically decaying
 * probability (position bias), and clicked with a probability that depends on
 * its human relevance grade. Everything is a pure function of an injected random
 * source, so the model is unit-testable and a seeded run is reproducible. The
 * generated events are written with source='synthetic', never passed off as real.
 */
export interface ClickModelParams {
  /** Geometric examination decay per rank: examine(p) = decay^(p-1). */
  decay: number;
  /** P(click | examined) by relevance grade (0 = irrelevant .. 2 = exact). */
  gradeClickProb: Record<number, number>;
  /** A session shows at most this many results (the storefront page size). */
  pageSize: number;
}

export const DEFAULT_CLICK_MODEL: ClickModelParams = {
  decay: 0.7,
  gradeClickProb: { 0: 0.05, 1: 0.4, 2: 0.85 },
  pageSize: 24,
};

/** Probability a result at 1-based `position` is examined (position bias). */
export function examineProbability(position: number, decay: number): number {
  return decay ** (position - 1);
}

/** Probability a result of `grade` shown at `position` is clicked. */
export function clickProbability(
  grade: number,
  position: number,
  params: ClickModelParams,
): number {
  const relevance = params.gradeClickProb[grade] ?? 0;
  return examineProbability(position, params.decay) * relevance;
}

/**
 * Decide which 1-based positions are clicked in one session, given the grades of
 * the ranked results and a [0,1) random source. Deterministic for a given rng.
 */
export function simulateClickedPositions(
  grades: number[],
  rng: () => number,
  params: ClickModelParams = DEFAULT_CLICK_MODEL,
): number[] {
  const clicked: number[] = [];
  for (let i = 0; i < grades.length; i++) {
    const position = i + 1;
    const grade = grades[i] ?? 0;
    if (rng() < clickProbability(grade, position, params)) clicked.push(position);
  }
  return clicked;
}

/** Sort a query's judged products best-first; the synthetic "result list". */
export function rankByGrade(
  judgments: { productId: number; grade: number }[],
): { productId: number; grade: number }[] {
  return [...judgments].sort((a, b) => b.grade - a.grade || a.productId - b.productId);
}

export interface SessionOpts {
  mode: "lexical" | "semantic" | "hybrid";
  latencyMs: number;
}

/**
 * The events for one simulated session: a search_performed over the (capped)
 * ranked list, then a result_clicked for each clicked position.
 */
export function buildSessionEvents(
  query: string,
  ranked: { productId: number; grade: number }[],
  opts: SessionOpts,
  rng: () => number,
  params: ClickModelParams = DEFAULT_CLICK_MODEL,
): SearchEventInput[] {
  const shown = ranked.slice(0, params.pageSize);
  const events: SearchEventInput[] = [
    {
      type: "search",
      query,
      mode: opts.mode,
      resultCount: shown.length,
      latencyMs: opts.latencyMs,
    },
  ];
  for (const position of simulateClickedPositions(shown.map((r) => r.grade), rng, params)) {
    const hit = shown[position - 1];
    if (hit) events.push({ type: "click", query, productId: hit.productId, position });
  }
  return events;
}

/** Deterministic PRNG (mulberry32) so a seeded simulation run is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
