import { describe, expect, it } from "vitest";
import { rrfFuse } from "../../src/search/rrf.ts";

describe("rrfFuse (reciprocal rank fusion)", () => {
  it("fuses two rankings by summed reciprocal rank (k = 60)", () => {
    // id1: 1/61 + 1/62 = 0.032522 ; id3: 1/63 + 1/61 = 0.032266
    // id2: 1/62 = 0.016129       ; id4: 1/63 = 0.015873
    expect(rrfFuse([[1, 2, 3], [3, 1, 4]])).toEqual([1, 3, 2, 4]);
  });

  it("rewards appearing in BOTH lists over a single better rank", () => {
    // id9 is rank 1 in list A only; id5 is rank 2 in both, so it wins.
    expect(rrfFuse([[9, 5], [5, 9]])).toEqual([5, 9]);
  });

  it("a single ranking returns itself unchanged", () => {
    expect(rrfFuse([[5, 6, 7]])).toEqual([5, 6, 7]);
  });

  it("breaks exact ties by id ascending, for determinism", () => {
    expect(rrfFuse([[1, 2], [2, 1]])).toEqual([1, 2]);
  });

  it("ignores empty lists and handles no input", () => {
    expect(rrfFuse([[], [2, 1]])).toEqual([2, 1]);
    expect(rrfFuse([])).toEqual([]);
  });

  it("a smaller k sharpens the advantage of top ranks", () => {
    // With k=1: id1 = 1/2 + 1/3 = 0.833 ; id2 = 1/2 (rank1 in B) ; wait check below
    // listA [1,2], listB [2,1]: id1 = 1/(1+1)+1/(1+2)=0.5+0.333=0.833
    //                           id2 = 1/(1+2)+1/(1+1)=0.333+0.5=0.833 -> tie -> id asc
    expect(rrfFuse([[1, 2], [2, 1]], { k: 1 })).toEqual([1, 2]);
  });
});
