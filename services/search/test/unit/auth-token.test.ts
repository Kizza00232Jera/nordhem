import { describe, expect, it } from "vitest";
import { bearerMatches } from "../../src/auth-token.ts";

// Step 12 bring-your-own-engine: the local search service can require a shared
// Bearer token (SEARCH_API_TOKEN) so, once tunnelled to the internet, only the
// deployed site (which knows the token) can use it. No token = open (dev/CI).
describe("bearerMatches", () => {
  it("is open when no token is configured", () => {
    expect(bearerMatches(undefined, undefined)).toBe(true);
    expect(bearerMatches("Bearer anything", "")).toBe(true);
  });

  it("requires a matching Bearer when a token is set", () => {
    expect(bearerMatches("Bearer secret", "secret")).toBe(true);
    expect(bearerMatches("bearer secret", "secret")).toBe(true); // case-insensitive scheme
    expect(bearerMatches("Bearer wrong", "secret")).toBe(false);
    expect(bearerMatches(undefined, "secret")).toBe(false);
    expect(bearerMatches("secret", "secret")).toBe(false); // missing the Bearer prefix
  });
});
