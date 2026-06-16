import { describe, expect, it } from "vitest";
import { moveDown, moveItem, moveUp } from "../lib/reorder";

// The curations pin list IS the search order: index 0 renders at result #1. The
// editor reorders it by arrow buttons and drag-and-drop, both of which run
// through these pure helpers, so the order logic is tested here, not in the UI.
describe("moveItem", () => {
  it("moves an item from one index to another, shifting the rest", () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
  });

  it("returns the SAME reference for a no-op or out-of-bounds move", () => {
    const a = [1, 2, 3];
    expect(moveItem(a, 1, 1)).toBe(a);
    expect(moveItem(a, -1, 0)).toBe(a);
    expect(moveItem(a, 0, 5)).toBe(a);
  });

  it("never mutates the input", () => {
    const a = [1, 2, 3];
    moveItem(a, 0, 2);
    expect(a).toEqual([1, 2, 3]);
  });
});

describe("moveUp / moveDown", () => {
  it("moveUp swaps an item with the one above it", () => {
    expect(moveUp([1, 2, 3], 2)).toEqual([1, 3, 2]);
  });

  it("moveUp at the top is a no-op (same reference)", () => {
    const a = [1, 2, 3];
    expect(moveUp(a, 0)).toBe(a);
  });

  it("moveDown swaps an item with the one below it", () => {
    expect(moveDown([1, 2, 3], 0)).toEqual([2, 1, 3]);
  });

  it("moveDown at the bottom is a no-op (same reference)", () => {
    const a = [1, 2, 3];
    expect(moveDown(a, 2)).toBe(a);
  });
});
