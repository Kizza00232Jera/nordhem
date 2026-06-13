import { describe, expect, it } from "vitest";
import { cartTotals, FLAT_SHIPPING_CENTS } from "../lib/cart-totals";

// Cart math is pure and the prices are integer cents (no floats in money).
// The free-delivery-over-€499 rule is the one the header banner already
// promises; below it a flat shipping fee applies. Fixtures hand-computed
// (docs/TESTING.md rule 4).
describe("cartTotals", () => {
  it("sums line subtotals (unit price × quantity)", () => {
    const t = cartTotals([
      { unitPriceCents: 12000, quantity: 1 },
      { unitPriceCents: 4900, quantity: 2 },
    ]);
    expect(t.subtotalCents).toBe(12000 + 4900 * 2); // 21800
  });

  it("charges flat shipping below the free threshold", () => {
    const t = cartTotals([{ unitPriceCents: 19800, quantity: 1 }]);
    expect(t.shippingCents).toBe(FLAT_SHIPPING_CENTS);
    expect(t.totalCents).toBe(19800 + FLAT_SHIPPING_CENTS);
  });

  it("gives free shipping at or above €499 (49900 cents)", () => {
    const t = cartTotals([{ unitPriceCents: 49900, quantity: 1 }]);
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(49900);
  });

  it("is still charged one cent under the threshold", () => {
    const t = cartTotals([{ unitPriceCents: 49899, quantity: 1 }]);
    expect(t.shippingCents).toBe(FLAT_SHIPPING_CENTS);
  });

  it("an empty cart is all zeroes (no shipping on nothing)", () => {
    expect(cartTotals([])).toEqual({
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
    });
  });
});
