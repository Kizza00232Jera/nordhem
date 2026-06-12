import { describe, expect, it } from "vitest";
import { parseProductsTsv } from "../../src/wands/parse.ts";

// Mirrors the real file: tab-separated, header row, pipe-delimited features,
// float-formatted counts ("15.0"), and optional fields left empty.
const TSV = [
  "product_id\tproduct_name\tproduct_class\tcategory hierarchy\tproduct_description\tproduct_features\trating_count\taverage_rating\treview_count",
  "0\tsolid wood platform bed\tBeds\tFurniture / Bedroom Furniture / Beds\ta nice , quality bed frame\tcolor : caramel|woodspecies : acacia\t15.0\t4.5\t15.0",
  "42\tmesh task chair\tOffice Chairs\t\t\t\t\t\t",
].join("\n");

describe("parseProductsTsv", () => {
  it("parses rows into typed products with numbers coerced", () => {
    const products = parseProductsTsv(TSV);

    expect(products).toHaveLength(2);
    expect(products[0]).toEqual({
      productId: 0,
      name: "solid wood platform bed",
      productClass: "Beds",
      categoryHierarchy: "Furniture / Bedroom Furniture / Beds",
      description: "a nice , quality bed frame",
      features: "color : caramel|woodspecies : acacia",
      ratingCount: 15,
      averageRating: 4.5,
      reviewCount: 15,
    });
  });

  it("maps empty optional fields to null", () => {
    const products = parseProductsTsv(TSV);

    expect(products[1]).toEqual({
      productId: 42,
      name: "mesh task chair",
      productClass: "Office Chairs",
      categoryHierarchy: null,
      description: null,
      features: null,
      ratingCount: null,
      averageRating: null,
      reviewCount: null,
    });
  });

  it("ignores trailing blank lines", () => {
    expect(parseProductsTsv(TSV + "\n\n")).toHaveLength(2);
  });
});
