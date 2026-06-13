/**
 * Cart money math. Prices are integer cents end-to-end (no floats in money).
 * Pure and DB-free so it is the unit-tested seam; the cart drawer, the /cart
 * page, and the checkout transaction all call it for one consistent total.
 */

/** Free delivery at or above €499 — the promise in the header banner. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 49_900;
/** Flat delivery fee below the threshold (a demo value, like the prices). */
export const FLAT_SHIPPING_CENTS = 4_900;

export interface CartLineInput {
  unitPriceCents: number;
  quantity: number;
}

export interface CartTotals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

export function cartTotals(lines: CartLineInput[]): CartTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
  // No shipping charged on an empty cart; free at or above the threshold.
  const shippingCents =
    subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : FLAT_SHIPPING_CENTS;
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
