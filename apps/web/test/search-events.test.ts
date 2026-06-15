import { describe, expect, it } from "vitest";
import { SearchEventSchema } from "@nordhem/shared";

// The first-party telemetry contract (Step 10). The browser fires these at the
// /api/events sink; the schema is the trust boundary, so it validates here once
// and both the client builder and the server route reuse it.
describe("SearchEventSchema", () => {
  it("accepts a valid search event", () => {
    const e = SearchEventSchema.parse({
      type: "search",
      query: "sofa",
      mode: "hybrid",
      resultCount: 12,
      latencyMs: 34,
    });
    expect(e).toEqual({ type: "search", query: "sofa", mode: "hybrid", resultCount: 12, latencyMs: 34 });
  });

  it("accepts a zero-result search (resultCount 0)", () => {
    const e = SearchEventSchema.parse({ type: "search", query: "xyzzy", mode: "lexical", resultCount: 0 });
    expect(e.type).toBe("search");
    expect((e as { resultCount: number }).resultCount).toBe(0);
  });

  it("accepts a valid click event", () => {
    const e = SearchEventSchema.parse({ type: "click", query: "sofa", productId: 42, position: 3 });
    expect(e).toEqual({ type: "click", query: "sofa", productId: 42, position: 3 });
  });

  it("trims the query", () => {
    const e = SearchEventSchema.parse({ type: "click", query: "  sofa  ", productId: 1, position: 1 });
    expect(e.query).toBe("sofa");
  });

  it("rejects an empty query", () => {
    expect(() =>
      SearchEventSchema.parse({ type: "search", query: "   ", mode: "hybrid", resultCount: 1 }),
    ).toThrow();
  });

  it("rejects an unknown search mode", () => {
    expect(() =>
      SearchEventSchema.parse({ type: "search", query: "sofa", mode: "magic", resultCount: 1 }),
    ).toThrow();
  });

  it("rejects a non-positive click position", () => {
    expect(() =>
      SearchEventSchema.parse({ type: "click", query: "sofa", productId: 1, position: 0 }),
    ).toThrow();
  });

  it("rejects an unknown event type", () => {
    expect(() => SearchEventSchema.parse({ type: "hover", query: "sofa" })).toThrow();
  });
});
