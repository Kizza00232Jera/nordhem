/**
 * WANDS ships no prices, so the shop generates honest fakes: a Knuth
 * multiplicative hash of the product id picks a stable point inside a
 * per-category price range, rounded down to a .99 ending. Deterministic,
 * so every re-curation produces identical prices, and id 1 lands on the
 * golden ratio (0.618…) — the classic Fibonacci-hashing property.
 */
const KNUTH = 2654435761;
const TWO_32 = 4294967296;

const RANGES_CENTS: Record<string, readonly [min: number, max: number]> = {
  beds: [19900, 89900],
  mattresses: [9900, 59900],
  sofas: [29900, 129900],
  wardrobes: [14900, 79900],
  desks: [8900, 49900],
  lighting: [1900, 24900],
  rugs: [2900, 39900],
  garden: [4900, 69900],
};

export function syntheticPriceCents(productId: number, category: string): number {
  const range = RANGES_CENTS[category];
  if (!range) {
    throw new Error(`No price range for category "${category}"`);
  }
  const [min, max] = range;
  // Safe in doubles: max productId (42,994) × KNUTH ≈ 1.1e14 < 2^53.
  const frac = ((productId * KNUTH) % TWO_32) / TWO_32;
  const raw = min + frac * (max - min);
  return Math.floor(raw / 1000) * 1000 - 1;
}
