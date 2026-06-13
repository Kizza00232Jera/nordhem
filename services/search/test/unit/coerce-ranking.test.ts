import { describe, expect, it } from "vitest";
import { coerceRankingConfig, DEFAULT_RANKING } from "../../src/search/query.ts";

// The /eval endpoint takes a config from the studio sliders, which is
// untrusted input. coerceRankingConfig clamps every knob into a safe range and
// falls back to the default for anything missing or invalid, so a bad request
// can never produce a broken or abusive query.
describe("coerceRankingConfig", () => {
  it("returns the default for empty or junk input", () => {
    expect(coerceRankingConfig(undefined)).toEqual(DEFAULT_RANKING);
    expect(coerceRankingConfig({})).toEqual(DEFAULT_RANKING);
    expect(coerceRankingConfig("nope")).toEqual(DEFAULT_RANKING);
  });

  it("keeps valid values", () => {
    expect(
      coerceRankingConfig({
        fields: { name: 5, productClass: 1, description: 0 },
        fuzziness: "AUTO",
        fuzzyPrefixLength: 1,
        minimumShouldMatch: "2<75%",
        phraseBoost: 6,
        popularityWeight: 0.5,
      }),
    ).toEqual({
      fields: { name: 5, productClass: 1, description: 0 },
      fuzziness: "AUTO",
      fuzzyPrefixLength: 1,
      minimumShouldMatch: "2<75%",
      phraseBoost: 6,
      popularityWeight: 0.5,
    });
  });

  it("clamps out-of-range numbers and drops invalid ones", () => {
    const c = coerceRankingConfig({
      fields: { name: 999, productClass: -3, description: "x" },
      fuzzyPrefixLength: 99,
      phraseBoost: -1,
      popularityWeight: 1000,
    });
    expect(c.fields.name).toBe(20); // clamped to max
    expect(c.fields.productClass).toBe(0); // clamped to min
    expect(c.fields.description).toBe(DEFAULT_RANKING.fields.description); // invalid -> default
    expect(c.fuzzyPrefixLength).toBe(5); // clamped to max
    expect(c.phraseBoost).toBe(0); // clamped to min
    expect(c.popularityWeight).toBe(10); // clamped to max
  });

  it("treats fuzziness null/\"off\" as no fuzziness", () => {
    expect(coerceRankingConfig({ fuzziness: null }).fuzziness).toBeUndefined();
    expect(coerceRankingConfig({ fuzziness: "off" }).fuzziness).toBeUndefined();
  });
});
