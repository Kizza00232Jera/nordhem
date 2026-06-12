import { describe, expect, it } from "vitest";
import { CATEGORIES, categorize } from "../../src/curate/categories.ts";

describe("NORDHEM category taxonomy", () => {
  it("defines the eight storefront categories in display order", () => {
    expect(CATEGORIES.map((c) => c.slug)).toEqual([
      "beds",
      "mattresses",
      "sofas",
      "wardrobes",
      "desks",
      "lighting",
      "rugs",
      "garden",
    ]);
  });
});

describe("categorize (WANDS product_class → NORDHEM category)", () => {
  it("maps core classes to their category", () => {
    expect(categorize("Beds")).toBe("beds");
    expect(categorize("Foam and Latex Mattresses")).toBe("mattresses");
    expect(categorize("Sofas")).toBe("sofas");
    expect(categorize("Armoires & Wardrobes")).toBe("wardrobes");
    expect(categorize("Desks")).toBe("desks");
    expect(categorize("Table Lamps")).toBe("lighting");
    expect(categorize("Area Rugs")).toBe("rugs");
    expect(categorize("Patio Sofas")).toBe("garden");
  });

  it("matches any segment of WANDS pipe-joined multi-class values", () => {
    // Real values from products_raw: "Futons|Sofas", "Bed Frames|Beds"
    expect(categorize("Futons|Sofas")).toBe("sofas");
    expect(categorize("Bed Frames|Beds")).toBe("beds");
    expect(categorize("Office Sets|Desks")).toBe("desks");
  });

  it("returns null for classes outside the shop taxonomy and for null", () => {
    expect(categorize("Wall Art")).toBeNull();
    expect(categorize("Bathroom Sink Faucets")).toBeNull();
    expect(categorize(null)).toBeNull();
  });

  it("does not substring-match: 'Kids Beds' is not 'Beds'", () => {
    // Exact segment equality only — a kids' bed is deliberately out of
    // the adult-focused shop taxonomy.
    expect(categorize("Kids Beds")).toBeNull();
  });
});
