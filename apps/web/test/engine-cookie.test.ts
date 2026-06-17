import { describe, expect, it } from "vitest";
import { isValidEngineUrl, parseEngineCookie, serializeEngine } from "../lib/engine-cookie";

// Step 12 bring-your-own-engine: a visitor connects their own tunnelled search
// service to the deployed site for THEIR session only. The {url, token} live in
// a cookie; parsing + URL validation are pure and tested here. https-only, so a
// malformed or plain-http override can never be used.
describe("isValidEngineUrl", () => {
  it("accepts only well-formed https URLs", () => {
    expect(isValidEngineUrl("https://abc.trycloudflare.com")).toBe(true);
    expect(isValidEngineUrl("http://abc.trycloudflare.com")).toBe(false);
    expect(isValidEngineUrl("not a url")).toBe(false);
    expect(isValidEngineUrl("")).toBe(false);
  });
});

describe("parseEngineCookie", () => {
  it("parses a valid override and strips a trailing slash", () => {
    const raw = serializeEngine("https://abc.trycloudflare.com/", "Nordhem123");
    expect(parseEngineCookie(raw)).toEqual({ url: "https://abc.trycloudflare.com", token: "Nordhem123" });
  });

  it("returns null for missing, malformed, non-https, or junk values", () => {
    expect(parseEngineCookie(undefined)).toBeNull();
    expect(parseEngineCookie("")).toBeNull();
    expect(parseEngineCookie("not json")).toBeNull();
    expect(parseEngineCookie(JSON.stringify({ url: "http://x.com", token: "t" }))).toBeNull();
    expect(parseEngineCookie(JSON.stringify({ token: "t" }))).toBeNull();
  });

  it("allows a tokenless override (token optional)", () => {
    expect(parseEngineCookie(JSON.stringify({ url: "https://x.com" }))).toEqual({ url: "https://x.com" });
  });
});
