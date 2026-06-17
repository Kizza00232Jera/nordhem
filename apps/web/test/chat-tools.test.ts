import { describe, expect, it } from "vitest";
import { formatHitsForModel, searchProductsTool, toolArgsToQueryString } from "../lib/chat/tools";

// Step 11c: the chatbot's only tool is search over OUR catalog, so the model
// answers from real products and never invents inventory. The arg->querystring
// mapping and the result formatting are pure, hence tested here; the live model
// call is the only external part.
describe("searchProductsTool", () => {
  it("declares an OpenAI-compatible function with a required query", () => {
    expect(searchProductsTool.type).toBe("function");
    expect(searchProductsTool.function.name).toBe("search_products");
    expect(searchProductsTool.function.parameters.required).toContain("query");
  });
});

describe("toolArgsToQueryString", () => {
  const parse = (s: string) => new URLSearchParams(s);

  it("always searches the shop scope with the query", () => {
    const p = parse(toolArgsToQueryString({ query: "oak bed" }));
    expect(p.get("q")).toBe("oak bed");
    expect(p.get("scope")).toBe("shop");
    expect(p.get("size")).toBe("6"); // sane default
  });

  it("maps filters and converts euros to cents", () => {
    const p = parse(
      toolArgsToQueryString({ query: "sofa", category: "sofas", color: "green", material: "velvet", priceMax: 500 }),
    );
    expect(p.get("category")).toBe("sofas");
    expect(p.get("color")).toBe("green");
    expect(p.get("material")).toBe("velvet");
    expect(p.get("priceMax")).toBe("50000"); // 500 euros -> cents
  });

  it("clamps size into 1..10", () => {
    expect(parse(toolArgsToQueryString({ query: "x", size: 99 })).get("size")).toBe("10");
    expect(parse(toolArgsToQueryString({ query: "x", size: 0 })).get("size")).toBe("1");
  });
});

describe("formatHitsForModel", () => {
  it("says so when there are no hits", () => {
    expect(formatHitsForModel([])).toMatch(/no matching products/i);
  });

  it("renders a compact numbered list with name, price and category", () => {
    const text = formatHitsForModel([
      { name: "Velvet Accent Chair", priceCents: 49999, category: "sofas", slug: "velvet-accent-chair-1" },
      { name: "Oak Bed", priceCents: null, category: "beds", slug: "oak-bed-3" },
    ]);
    expect(text).toContain("1. Velvet Accent Chair");
    expect(text).toContain("499.99");
    expect(text).toContain("sofas");
    expect(text).toContain("2. Oak Bed");
  });
});
