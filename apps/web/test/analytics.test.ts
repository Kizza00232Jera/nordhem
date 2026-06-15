import { describe, expect, it } from "vitest";
import { ctrByPositionFrom } from "../lib/analytics-repo";

// CTR by position is the position-bias view: clicks at rank p divided by the
// IMPRESSIONS at rank p, where a search that returned N results counts as an
// impression for every position 1..N. This pure function does that math from a
// result-count distribution and a clicks-per-position map, so the SQL only has
// to produce those two cheap aggregates.
describe("ctrByPositionFrom", () => {
  it("divides clicks by impressions, impressions(p) = searches with resultCount >= p", () => {
    const distribution = [
      { resultCount: 5, n: 3 }, // 3 searches returned 5 results
      { resultCount: 1, n: 2 }, // 2 searches returned 1 result
    ];
    const clicks = { 1: 4, 2: 1 };
    expect(ctrByPositionFrom(distribution, clicks, 3)).toEqual([
      { position: 1, impressions: 5, clicks: 4, ctr: 4 / 5 },
      { position: 2, impressions: 3, clicks: 1, ctr: 1 / 3 },
      { position: 3, impressions: 3, clicks: 0, ctr: 0 },
    ]);
  });

  it("never divides by zero (no impressions -> ctr 0)", () => {
    expect(ctrByPositionFrom([], { 1: 0 }, 2)).toEqual([
      { position: 1, impressions: 0, clicks: 0, ctr: 0 },
      { position: 2, impressions: 0, clicks: 0, ctr: 0 },
    ]);
  });

  it("accepts a Map of clicks too", () => {
    const ctr = ctrByPositionFrom([{ resultCount: 10, n: 1 }], new Map([[1, 1]]), 1);
    expect(ctr).toEqual([{ position: 1, impressions: 1, clicks: 1, ctr: 1 }]);
  });
});
