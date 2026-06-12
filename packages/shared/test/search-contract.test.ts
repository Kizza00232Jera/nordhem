import { describe, expect, it } from "vitest";
import { SearchResponseSchema } from "../src/index.ts";

// A realistic full-mode payload, written as the SPEC for what the search
// service must return — the service is built to satisfy this fixture,
// not the other way around (docs/TESTING.md rule 4).
const fullModePayload = {
  query: "outdoor chair",
  mode: "full",
  total: 2,
  tookMs: 12,
  hits: [
    {
      id: "wands-10071",
      name: "fontayne mesh task chair",
      productClass: "office chairs",
      description: "ergonomic mesh back office chair with lumbar support",
      score: 7.31,
    },
    {
      // WANDS has products with no class — the contract must allow it.
      id: "wands-2231",
      name: "lounge patio chair set of 2",
      productClass: null,
      description: null,
      score: 5.02,
    },
  ],
};

describe("SearchResponse contract", () => {
  it("parses a full-mode payload and preserves hit order and values", () => {
    const parsed = SearchResponseSchema.parse(fullModePayload);

    expect(parsed.query).toBe("outdoor chair");
    expect(parsed.mode).toBe("full");
    expect(parsed.total).toBe(2);
    expect(parsed.hits).toHaveLength(2);
    expect(parsed.hits[0]).toEqual({
      id: "wands-10071",
      name: "fontayne mesh task chair",
      productClass: "office chairs",
      description: "ergonomic mesh back office chair with lumbar support",
      score: 7.31,
    });
    expect(parsed.hits[1]?.description).toBeNull();
    expect(parsed.hits[1]?.productClass).toBeNull();
  });

  it("rejects a payload whose hits are missing required fields", () => {
    const broken = {
      ...fullModePayload,
      hits: [{ id: "wands-1" }],
    };

    expect(() => SearchResponseSchema.parse(broken)).toThrowError();
  });

  it("rejects an unknown mode", () => {
    expect(() =>
      SearchResponseSchema.parse({ ...fullModePayload, mode: "turbo" }),
    ).toThrowError();
  });

  it("roundtrips shop-index hits carrying storefront card fields", () => {
    // Shop-scope hits add what a product card needs; the fields are
    // optional because benchmark-index hits don't have them.
    const payload = {
      ...fullModePayload,
      total: 1,
      hits: [
        {
          id: "40511",
          name: "imani velvet sleeper",
          productClass: "Sofas",
          description: null,
          score: 9.1,
          slug: "imani-velvet-sleeper-40511",
          category: "sofas",
          priceCents: 105999,
          imageThumbUrl: "https://images.unsplash.com/photo-x?w=400",
        },
      ],
    };

    const parsed = SearchResponseSchema.parse(payload);
    expect(parsed.hits[0]?.slug).toBe("imani-velvet-sleeper-40511");
    expect(parsed.hits[0]?.priceCents).toBe(105999);
    expect(parsed.hits[0]?.imageThumbUrl).toContain("unsplash");
  });
});
