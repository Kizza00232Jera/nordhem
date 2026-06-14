import { describe, expect, it } from "vitest";
import { validateSynonymRule } from "../lib/synonyms-rules";

describe("validateSynonymRule", () => {
  it("rejects an equivalent group with fewer than two terms", () => {
    expect(validateSynonymRule({ kind: "equivalent", terms: "sofa" }).ok).toBe(false);
  });

  it("accepts a valid equivalent group with no warning", () => {
    const r = validateSynonymRule({ kind: "equivalent", terms: "sofa, couch, settee" });
    expect(r.ok).toBe(true);
    expect(r.warning).toBeUndefined();
  });

  it("rejects a one-way rule with no target", () => {
    expect(validateSynonymRule({ kind: "oneway", terms: "couch", mapsTo: "" }).ok).toBe(false);
  });

  it("accepts a one-way rule with a target", () => {
    expect(validateSynonymRule({ kind: "oneway", terms: "hassock", mapsTo: "ottoman" }).ok).toBe(true);
  });

  it("warns (but allows) a term whose stopword the analyzer would drop", () => {
    const r = validateSynonymRule({ kind: "equivalent", terms: "dresser, chest of drawers" });
    expect(r.ok).toBe(true);
    expect(r.warning).toContain("chest of drawers");
  });

  it("does not warn on multi-word terms without a stopword", () => {
    const r = validateSynonymRule({ kind: "equivalent", terms: "coffee table, cocktail table" });
    expect(r.ok).toBe(true);
    expect(r.warning).toBeUndefined();
  });
});
