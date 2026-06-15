import { describe, expect, it } from "vitest";
import {
  buildSessionEvents,
  clickProbability,
  DEFAULT_CLICK_MODEL,
  examineProbability,
  mulberry32,
  rankByGrade,
  simulateClickedPositions,
} from "../../src/analytics/simulate.ts";

// The simulated-traffic click model (Step 10 slice 4). Honest synthetic data:
// a position-biased examination curve times a per-grade click probability, all
// deterministic given the random source, so it is unit-testable and a seeded
// run is reproducible.

describe("examineProbability", () => {
  it("decays geometrically with rank", () => {
    expect(examineProbability(1, 0.7)).toBe(1);
    expect(examineProbability(2, 0.7)).toBeCloseTo(0.7, 10);
    expect(examineProbability(3, 0.7)).toBeCloseTo(0.49, 10);
  });
});

describe("clickProbability", () => {
  it("rises with grade and falls with position", () => {
    expect(clickProbability(2, 1, DEFAULT_CLICK_MODEL)).toBeCloseTo(0.85, 10);
    expect(clickProbability(2, 1, DEFAULT_CLICK_MODEL)).toBeGreaterThan(
      clickProbability(1, 1, DEFAULT_CLICK_MODEL),
    );
    expect(clickProbability(1, 1, DEFAULT_CLICK_MODEL)).toBeGreaterThan(
      clickProbability(0, 1, DEFAULT_CLICK_MODEL),
    );
    expect(clickProbability(2, 1, DEFAULT_CLICK_MODEL)).toBeGreaterThan(
      clickProbability(2, 2, DEFAULT_CLICK_MODEL),
    );
  });

  it("is zero for a grade with no click probability", () => {
    expect(clickProbability(5, 1, DEFAULT_CLICK_MODEL)).toBe(0);
  });
});

describe("simulateClickedPositions", () => {
  it("clicks every positive-probability position when the rng is always 0", () => {
    expect(simulateClickedPositions([2, 1, 0], () => 0)).toEqual([1, 2, 3]);
  });

  it("clicks nothing when the rng is above the max probability", () => {
    expect(simulateClickedPositions([2, 1, 0], () => 0.99)).toEqual([]);
  });

  it("never clicks a zero-probability grade even at rng 0", () => {
    expect(simulateClickedPositions([2, 5], () => 0)).toEqual([1]);
  });
});

describe("rankByGrade", () => {
  it("orders judged products best-first, productId breaking ties", () => {
    expect(
      rankByGrade([
        { productId: 1, grade: 0 },
        { productId: 2, grade: 2 },
        { productId: 3, grade: 1 },
        { productId: 4, grade: 2 },
      ]),
    ).toEqual([
      { productId: 2, grade: 2 },
      { productId: 4, grade: 2 },
      { productId: 3, grade: 1 },
      { productId: 1, grade: 0 },
    ]);
  });
});

describe("buildSessionEvents", () => {
  const opts = { mode: "hybrid", latencyMs: 33 } as const;

  it("emits only a search event when nothing is clicked", () => {
    const events = buildSessionEvents(
      "oak bed",
      [
        { productId: 10, grade: 2 },
        { productId: 20, grade: 1 },
      ],
      opts,
      () => 0.99,
    );
    expect(events).toEqual([
      { type: "search", query: "oak bed", mode: "hybrid", resultCount: 2, latencyMs: 33 },
    ]);
  });

  it("maps clicked positions back to their productIds", () => {
    const events = buildSessionEvents(
      "oak bed",
      [
        { productId: 10, grade: 2 },
        { productId: 20, grade: 1 },
      ],
      opts,
      () => 0,
    );
    expect(events).toEqual([
      { type: "search", query: "oak bed", mode: "hybrid", resultCount: 2, latencyMs: 33 },
      { type: "click", query: "oak bed", productId: 10, position: 1 },
      { type: "click", query: "oak bed", productId: 20, position: 2 },
    ]);
  });

  it("caps the result count at the page size", () => {
    const ranked = Array.from({ length: 30 }, (_, i) => ({ productId: i + 1, grade: 0 }));
    const params = { ...DEFAULT_CLICK_MODEL, pageSize: 5 };
    const [search] = buildSessionEvents("desk", ranked, opts, () => 0.99, params);
    expect(search).toMatchObject({ type: "search", resultCount: 5 });
  });
});

describe("mulberry32", () => {
  it("is reproducible for a seed and stays in [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const x = a();
    expect(b()).toBe(x);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});
