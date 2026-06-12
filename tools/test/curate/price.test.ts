import { describe, expect, it } from "vitest";
import { syntheticPriceCents } from "../../src/curate/price.ts";

describe("syntheticPriceCents (deterministic Fibonacci-hash price)", () => {
  it("computes the hand-checked value for productId 1 in beds", () => {
    // Hand computation (algorithm: Knuth multiplicative hash):
    //   hash = (1 × 2654435761) mod 2^32 = 2654435761
    //   frac = 2654435761 / 4294967296 = 0.61803398... (the golden ratio)
    //   beds range: 19900..89900 cents
    //   raw  = 19900 + 0.61803398 × (89900 − 19900) = 19900 + 43262.38 = 63162.38
    //   price = floor(63162.38 / 1000) × 1000 − 1 = 63000 − 1 = 62999  ($629.99)
    expect(syntheticPriceCents(1, "beds")).toBe(62999);
  });

  it("computes the floor case for productId 0 (frac = 0)", () => {
    // hash = 0 → frac = 0 → raw = 19900 → floor(19.9) × 1000 − 1 = 18999.
    // Rounding may dip below the range minimum by under $10 — accepted.
    expect(syntheticPriceCents(0, "beds")).toBe(18999);
  });

  it("is deterministic and ends in .99", () => {
    const a = syntheticPriceCents(4242, "rugs");
    const b = syntheticPriceCents(4242, "rugs");
    expect(a).toBe(b);
    expect(a % 100).toBe(99);
  });

  it("stays within each category's range (+rounding slack) for many ids", () => {
    for (let id = 0; id < 500; id++) {
      const p = syntheticPriceCents(id, "lighting");
      expect(p).toBeGreaterThanOrEqual(1900 - 1000);
      expect(p).toBeLessThanOrEqual(24900);
    }
  });

  it("throws on an unknown category", () => {
    expect(() => syntheticPriceCents(1, "spaceships")).toThrowError();
  });
});
