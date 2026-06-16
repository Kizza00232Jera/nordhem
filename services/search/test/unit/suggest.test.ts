import { describe, expect, it } from "vitest";
import { proposeSynonyms, trigramSimilarity } from "../../src/analytics/suggest.ts";

// Step 11b heuristic generator. trigramSimilarity is a Dice coefficient over
// character trigrams; proposeSynonyms uses it to map a zero-result query onto
// the closest catalog term when they are spelling/spacing/plural variants. It
// deliberately does NOT invent semantic synonyms (couch->sofa) — that is the
// Claude-session path — and skips true out-of-catalog misses.
describe("trigramSimilarity", () => {
  it("is 1 for identical strings and 0 for fully disjoint ones", () => {
    expect(trigramSimilarity("sofa", "sofa")).toBe(1);
    expect(trigramSimilarity("sofa", "zzz")).toBe(0);
  });

  it("is high for a near variant and low for an unrelated word", () => {
    expect(trigramSimilarity("sofaa", "sofa")).toBeGreaterThan(0.5);
    expect(trigramSimilarity("trampoline", "sofa")).toBeLessThan(0.2);
  });
});

describe("proposeSynonyms", () => {
  const catalog = ["sofa", "bunk bed", "tv stand", "mattress"];

  it("maps a near-miss query to its closest catalog term as a one-way synonym", () => {
    const out = proposeSynonyms([{ query: "Sofaa" }], catalog);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ query: "Sofaa", kind: "oneway", terms: "sofaa", mapsTo: "sofa" });
    expect(out[0]!.rationale).toContain("sofa");
  });

  it("catches a spacing variant (bunkbed -> bunk bed)", () => {
    const out = proposeSynonyms([{ query: "bunkbed" }], catalog);
    expect(out[0]?.mapsTo).toBe("bunk bed");
  });

  it("skips true out-of-catalog misses below the threshold", () => {
    expect(proposeSynonyms([{ query: "trampoline" }], catalog)).toEqual([]);
  });

  it("skips a query that already matches a catalog term exactly", () => {
    expect(proposeSynonyms([{ query: "sofa" }], catalog)).toEqual([]);
  });
});
