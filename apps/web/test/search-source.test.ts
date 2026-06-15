import type { SearchResponse } from "@nordhem/shared";
import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "../lib/circuit-breaker";
import { resolveSearch } from "../lib/search-source";

const FULL: SearchResponse = { query: "x", mode: "full", total: 1, tookMs: 5, hits: [] };
const LITE: SearchResponse = { query: "x", mode: "fallback", total: 0, tookMs: 1, hits: [] };

// resolveSearch is the breaker-guarded retrieval policy: try the full service,
// fall back to Postgres FTS on failure, and skip the service entirely while the
// breaker is open. Stubbed full/fallback so the policy is the thing tested.
describe("resolveSearch", () => {
  it("uses the full service and records success when it works", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 100, now: () => 0 });
    const fallback = vi.fn().mockResolvedValue(LITE);
    const r = await resolveSearch({ breaker, full: () => Promise.resolve(FULL), fallback });
    expect(r).toEqual({ response: FULL, lite: false });
    expect(fallback).not.toHaveBeenCalled();
    expect(breaker.current).toBe("closed");
  });

  it("falls back to Postgres and records a failure when the service throws", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100, now: () => 0 });
    const r = await resolveSearch({
      breaker,
      full: () => Promise.reject(new Error("down")),
      fallback: () => Promise.resolve(LITE),
    });
    expect(r).toEqual({ response: LITE, lite: true });
    expect(breaker.current).toBe("open"); // threshold 1 -> open after one failure
  });

  it("skips the full service entirely while the breaker is open", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100, now: () => 0 });
    breaker.recordFailure(); // open
    const full = vi.fn();
    const r = await resolveSearch({ breaker, full, fallback: () => Promise.resolve(LITE) });
    expect(full).not.toHaveBeenCalled();
    expect(r.lite).toBe(true);
  });
});
