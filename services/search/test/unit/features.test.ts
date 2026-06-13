import { describe, expect, it } from "vitest";
import { extractColor, extractMaterial } from "../../src/wands/features.ts";

// Real WANDS feature blobs: pipe-delimited segments, text values written as
// "key : value" (spaces around the colon), numeric values as "key:value"
// (no spaces), plus an empty-key noise segment (" : ...") and duplicate keys.
// Fixtures below mirror that exact shape (taken from product 3, the pizza
// cutter, and friends).
describe("extractColor", () => {
  it("reads the `color` value, lowercased and trimmed", () => {
    const features =
      "overallwidth-sidetoside:3.5|primarymaterial : stainless steel|color : Silver|numberofpiecesincluded:1";
    expect(extractColor(features)).toBe("silver");
  });

  it("falls back to `primarycolor` (rugs use that key)", () => {
    expect(extractColor("primarycolor : Navy|material : wool")).toBe("navy");
  });

  it("returns null when no colour key is present", () => {
    const features = "dsprimaryproductstyle : modern|headboardtype : slat";
    expect(extractColor(features)).toBeNull();
  });

  it("returns null for missing or empty features", () => {
    expect(extractColor(null)).toBeNull();
    expect(extractColor("")).toBeNull();
  });
});

describe("extractMaterial", () => {
  it("reads `primarymaterial`", () => {
    const features = "color : silver|primarymaterial : Stainless Steel|producttype : pizza cutter";
    expect(extractMaterial(features)).toBe("stainless steel");
  });

  it("prefers `primarymaterial` over a plain `material`", () => {
    expect(extractMaterial("material : oak|primarymaterial : metal")).toBe("metal");
  });

  it("falls back to `material` when there is no primary one", () => {
    expect(extractMaterial("material : Oak|color : brown")).toBe("oak");
  });

  it("ignores the empty-key noise segment and unrelated keys", () => {
    // " : slow cooker , lid" is the blank-key noise; housingheatingbasematerial
    // is not one of our material keys, so neither should match.
    const features = "features : keep warm| : slow cooker , lid|housingheatingbasematerial : steel";
    expect(extractMaterial(features)).toBeNull();
  });
});
