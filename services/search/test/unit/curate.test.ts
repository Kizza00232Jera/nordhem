import { describe, expect, it } from "vitest";
import { curateIds, normalizeCurationQuery } from "../../src/search/curate.ts";

describe("curateIds", () => {
  it("forces a pinned id to the front", () => {
    expect(curateIds([3, 4, 5], { pinned: [5], hidden: [] })).toEqual([5, 3, 4]);
  });
  it("drops hidden ids", () => {
    expect(curateIds([3, 4, 5], { pinned: [], hidden: [4] })).toEqual([3, 5]);
  });
  it("adds a pinned id even if search never returned it", () => {
    expect(curateIds([3, 4], { pinned: [9], hidden: [] })).toEqual([9, 3, 4]);
  });
  it("keeps pin order and dedupes against the ranked list", () => {
    expect(curateIds([1, 2, 3], { pinned: [3, 1], hidden: [] })).toEqual([3, 1, 2]);
  });
  it("hidden wins if an id is both pinned and hidden", () => {
    expect(curateIds([1, 2], { pinned: [2], hidden: [2] })).toEqual([1]);
  });
});

describe("normalizeCurationQuery", () => {
  it("trims and lowercases so query variants share one rule", () => {
    expect(normalizeCurationQuery("  Sofa Bed ")).toBe("sofa bed");
  });
});
