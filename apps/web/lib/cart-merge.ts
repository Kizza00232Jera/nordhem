/**
 * Merge a guest cart into a user's cart on login. Additive: a product in
 * both carts has its quantities summed (capped), products in only one are
 * kept. The guest just added those items this session, so the additive
 * strategy never silently drops them — see D43 for the rejected alternatives
 * (replace / keep-user / max). Pure; the DB write that applies it is tested
 * separately against real Postgres.
 */

export const MAX_QUANTITY = 99;

export interface MergeLine {
  productId: number;
  quantity: number;
}

export function mergeCarts(
  userLines: MergeLine[],
  guestLines: MergeLine[],
): MergeLine[] {
  // Insertion order: user lines first (in their order), then guest-only
  // products appended in guest order — a Map preserves that.
  const merged = new Map<number, number>();
  for (const line of userLines) merged.set(line.productId, line.quantity);
  for (const line of guestLines) {
    const summed = (merged.get(line.productId) ?? 0) + line.quantity;
    merged.set(line.productId, Math.min(MAX_QUANTITY, summed));
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}
