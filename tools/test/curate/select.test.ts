import { describe, expect, it } from "vitest";
import { selectShopProducts, slugifyName } from "../../src/curate/select.ts";

interface Candidate {
  productId: number;
  name: string;
  productClass: string | null;
  description: string | null;
  ratingCount: number | null;
}

function candidate(overrides: Partial<Candidate> & Pick<Candidate, "productId" | "name">): Candidate {
  return { productClass: "Beds", description: "a bed", ratingCount: 10, ...overrides };
}

describe("slugifyName", () => {
  it("builds url-safe, unique slugs from name + id", () => {
    expect(slugifyName("solid wood platform bed", 7)).toBe("solid-wood-platform-bed-7");
    expect(slugifyName("sisco 28 '' wide tufted velvet armchair", 18512)).toBe(
      "sisco-28-wide-tufted-velvet-armchair-18512",
    );
  });
});

describe("selectShopProducts", () => {
  it("keeps only mappable classes and assigns category + price + slug", () => {
    const picked = selectShopProducts(
      [
        candidate({ productId: 1, name: "oak bed", productClass: "Beds" }),
        candidate({ productId: 2, name: "wall art", productClass: "Wall Art" }),
      ],
      100,
    );

    expect(picked).toHaveLength(1);
    expect(picked[0]).toEqual({
      productId: 1,
      slug: "oak-bed-1",
      category: "beds",
      priceCents: 62999, // the hand-computed beds price for id 1
    });
  });

  it("prefers described, well-rated products and caps per category", () => {
    const picked = selectShopProducts(
      [
        candidate({ productId: 1, name: "no desc", description: null, ratingCount: 999 }),
        candidate({ productId: 2, name: "low rated", ratingCount: 1 }),
        candidate({ productId: 3, name: "top rated", ratingCount: 50 }),
      ],
      2,
    );

    // Described products beat undescribed ones regardless of rating;
    // within described, higher rating count wins.
    expect(picked.map((p) => p.productId)).toEqual([3, 2]);
  });

  it("is deterministic: equal candidates tie-break by productId", () => {
    const rows = [
      candidate({ productId: 9, name: "b" }),
      candidate({ productId: 4, name: "a" }),
    ];
    expect(selectShopProducts(rows, 5).map((p) => p.productId)).toEqual([4, 9]);
    expect(selectShopProducts([...rows].reverse(), 5).map((p) => p.productId)).toEqual([4, 9]);
  });
});
