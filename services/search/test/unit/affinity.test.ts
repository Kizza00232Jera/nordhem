import { describe, expect, it } from "vitest";
import {
  aggregateAffinities,
  correctedClickValue,
  type ClickObservation,
} from "../../src/analytics/affinity.ts";

// Step 11a — the click-feedback learning loop. Implicit feedback (clicks) is
// biased by position: top results get clicked more just for being on top. We
// undo that with inverse-propensity weighting — a click is divided by the
// probability that its position was even examined. examine(p) = decay^(p-1),
// so the corrected value is (1/decay)^(p-1): a click deep in the list, which
// required scrolling past everything above, counts for MORE than a shallow one.
describe("correctedClickValue (inverse-propensity weight)", () => {
  // decay 0.5 makes the weights clean powers of two, hand-checkable:
  // pos1 -> (1/0.5)^0 = 1, pos2 -> 2^1 = 2, pos3 -> 2^2 = 4.
  it("weights deeper clicks more, with decay 0.5 giving powers of two", () => {
    expect(correctedClickValue(1, 0.5)).toBe(1);
    expect(correctedClickValue(2, 0.5)).toBe(2);
    expect(correctedClickValue(3, 0.5)).toBe(4);
  });

  // The storefront default decay is 0.7 (DEFAULT_CLICK_MODEL). pos2 weight is
  // 1/0.7 = 1.428..., a real number — assert it precisely, not "is defined".
  it("matches the 0.7 default decay used by the simulator", () => {
    expect(correctedClickValue(1, 0.7)).toBeCloseTo(1, 10);
    expect(correctedClickValue(2, 0.7)).toBeCloseTo(1.4285714285, 9);
    expect(correctedClickValue(3, 0.7)).toBeCloseTo(2.0408163265, 9);
  });
});

describe("aggregateAffinities", () => {
  // Hand-computed fixture (decay 0.5). The point of position-bias correction:
  //   "oak bed" / 100 -> clicked twice at pos 1   -> raw 1 + 1 = 2
  //   "oak bed" / 200 -> clicked ONCE at pos 3    -> raw 4
  // so the single deep click beats two shallow ones. Per-query normalisation
  // divides by the query's top raw score, bounding affinity to (0, 1] so a
  // high-traffic query can't mint unbounded boosts (the cap against runaway
  // rich-get-richer feedback).
  const clicks: ClickObservation[] = [
    { query: "oak bed", productId: 100, position: 1 },
    { query: "oak bed", productId: 100, position: 1 },
    { query: "oak bed", productId: 200, position: 3 },
    { query: "sofa", productId: 300, position: 2 },
  ];

  it("corrects for position bias: one deep click outranks two shallow ones", () => {
    const rows = aggregateAffinities(clicks, { decay: 0.5 });
    const byKey = new Map(rows.map((r) => [`${r.query}|${r.productId}`, r]));

    const p100 = byKey.get("oak bed|100")!;
    const p200 = byKey.get("oak bed|200")!;
    expect(p100.observations).toBe(2);
    expect(p100.rawScore).toBe(2);
    expect(p200.observations).toBe(1);
    expect(p200.rawScore).toBe(4);

    // 200's lone deep click wins the normalised affinity.
    expect(p200.affinity).toBe(1);
    expect(p100.affinity).toBe(0.5);
    expect(p200.affinity).toBeGreaterThan(p100.affinity);
  });

  it("normalises per query, not globally", () => {
    const rows = aggregateAffinities(clicks, { decay: 0.5 });
    const sofa = rows.find((r) => r.query === "sofa" && r.productId === 300)!;
    // sofa's only product is its own top, so affinity 1 regardless of the
    // larger raw scores in the "oak bed" query.
    expect(sofa.rawScore).toBe(2);
    expect(sofa.affinity).toBe(1);
  });

  it("returns rows sorted by query then affinity descending", () => {
    const rows = aggregateAffinities(clicks, { decay: 0.5 });
    expect(rows.map((r) => `${r.query}|${r.productId}`)).toEqual([
      "oak bed|200",
      "oak bed|100",
      "sofa|300",
    ]);
  });

  it("returns nothing for no clicks", () => {
    expect(aggregateAffinities([], { decay: 0.7 })).toEqual([]);
  });
});
