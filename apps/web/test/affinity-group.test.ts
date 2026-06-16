import { describe, expect, it } from "vitest";
import { boostWeight, toQueryAffinities, type AffinityRowRaw } from "../lib/affinity-repo";

// The studio learning-loop page reads click_affinity rows and groups them by
// query for display. The grouping + boost-weight math is pure, so it is unit
// tested here; the DB read that feeds it is thin. boostWeight mirrors the
// search service's DEFAULT_AFFINITY_BOOST (scale 6, cap 8) so the studio shows
// exactly the boost the query will apply.
describe("boostWeight", () => {
  it("scales affinity and caps it", () => {
    expect(boostWeight(1)).toBe(6);
    expect(boostWeight(0.5)).toBe(3);
    expect(boostWeight(2)).toBe(8); // capped
    expect(boostWeight(0)).toBe(0);
  });
});

describe("toQueryAffinities", () => {
  const rows: AffinityRowRaw[] = [
    { query: "oak bed", productId: 200, name: "Acacia Bed", observations: 1, affinity: 1, source: "live" },
    { query: "oak bed", productId: 100, name: "Pine Bed", observations: 2, affinity: 0.5, source: "live" },
    { query: "sofa", productId: 300, name: null, observations: 1, affinity: 1, source: "live" },
  ];

  it("groups by query with entries sorted by affinity, carrying the boost", () => {
    const groups = toQueryAffinities(rows);
    expect(groups.map((g) => g.query)).toEqual(["oak bed", "sofa"]);

    const oakBed = groups[0]!;
    expect(oakBed.entries).toEqual([
      { productId: 200, name: "Acacia Bed", observations: 1, affinity: 1, boost: 6 },
      { productId: 100, name: "Pine Bed", observations: 2, affinity: 0.5, boost: 3 },
    ]);
  });

  it("falls back to a #id label when the product name is missing", () => {
    const groups = toQueryAffinities(rows);
    expect(groups[1]!.entries[0]!.name).toBe("#300");
  });

  it("returns nothing for no rows", () => {
    expect(toQueryAffinities([])).toEqual([]);
  });
});
