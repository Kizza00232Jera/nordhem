import { describe, expect, it } from "vitest";
import { goToPage, setSingleParam, toggleListParam } from "../lib/facet-url";

// Facet state lives entirely in the querystring (shareable, back/forward,
// works before JS — D37). These pure helpers are the seam the UI is built
// on, so they're the unit-tested part (per docs/TESTING.md).
describe("toggleListParam (multi-select facets)", () => {
  it("adds a value when absent", () => {
    const next = new URLSearchParams(toggleListParam("q=oak", "color", "white"));
    expect(next.getAll("color")).toEqual(["white"]);
    expect(next.get("q")).toBe("oak");
  });

  it("removes a value when already present", () => {
    const next = new URLSearchParams(
      toggleListParam("q=oak&color=white", "color", "white"),
    );
    expect(next.getAll("color")).toEqual([]);
    expect(next.get("q")).toBe("oak");
  });

  it("keeps other selected values in the same facet (OR within a facet)", () => {
    const next = new URLSearchParams(
      toggleListParam("q=oak&color=white", "color", "black"),
    );
    expect(next.getAll("color").sort()).toEqual(["black", "white"]);
  });

  it("resets to page 1 (the old page may not exist after narrowing)", () => {
    const next = new URLSearchParams(
      toggleListParam("q=oak&page=4", "category", "sofas"),
    );
    expect(next.has("page")).toBe(false);
  });
});

describe("setSingleParam (sort, price band)", () => {
  it("sets a single value and resets the page", () => {
    const next = new URLSearchParams(
      setSingleParam("q=oak&page=3", "sort", "price_asc"),
    );
    expect(next.get("sort")).toBe("price_asc");
    expect(next.has("page")).toBe(false);
  });

  it("clears the param when value is null", () => {
    const next = new URLSearchParams(
      setSingleParam("q=oak&sort=price_asc", "sort", null),
    );
    expect(next.has("sort")).toBe(false);
  });
});

describe("goToPage (pagination preserves all filters, no reset)", () => {
  it("sets the page while keeping every other param", () => {
    const next = new URLSearchParams(
      goToPage("q=oak&color=white&sort=price_asc", 3),
    );
    expect(next.get("page")).toBe("3");
    expect(next.get("color")).toBe("white");
    expect(next.get("sort")).toBe("price_asc");
  });
});
