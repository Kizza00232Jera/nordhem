import { describe, expect, it } from "vitest";
import { parseSolrRule, parseSynonymRules, toSolrRule } from "../../src/es/synonyms.ts";

describe("parseSynonymRules", () => {
  it("keeps rule lines, drops comments and blank lines, trims whitespace", () => {
    const file = [
      "# furniture synonyms v1",
      "",
      "sofa, couch, settee",
      "  rug, carpet  ",
      "   ",
      "# tv furniture",
      "tv stand, entertainment center, media console",
    ].join("\n");

    expect(parseSynonymRules(file)).toEqual([
      "sofa, couch, settee",
      "rug, carpet",
      "tv stand, entertainment center, media console",
    ]);
  });
});

describe("toSolrRule", () => {
  it("renders an equivalent group as a comma list", () => {
    expect(toSolrRule({ kind: "equivalent", terms: "sofa, couch, settee" })).toBe("sofa, couch, settee");
  });
  it("renders a one-way rule with the => arrow", () => {
    expect(toSolrRule({ kind: "oneway", terms: "couch, settee", mapsTo: "sofa" })).toBe("couch, settee => sofa");
  });
  it("trims surrounding whitespace on both sides", () => {
    expect(toSolrRule({ kind: "oneway", terms: "  chase lounge  ", mapsTo: "  chaise lounge " })).toBe("chase lounge => chaise lounge");
  });
});

describe("parseSolrRule", () => {
  it("reads an equivalent line", () => {
    expect(parseSolrRule("sofa, couch, settee")).toEqual({ kind: "equivalent", terms: "sofa, couch, settee", mapsTo: null });
  });
  it("reads a one-way line, splitting on =>", () => {
    expect(parseSolrRule("couch, settee => sofa")).toEqual({ kind: "oneway", terms: "couch, settee", mapsTo: "sofa" });
  });
  it("round-trips with toSolrRule", () => {
    for (const line of ["rug, carpet", "cocktail table => coffee table"]) {
      expect(toSolrRule(parseSolrRule(line))).toBe(line);
    }
  });
});
