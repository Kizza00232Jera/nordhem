import { describe, expect, it } from "vitest";
import { parseSynonymRules } from "../../src/es/synonyms.ts";

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
