import { describe, expect, it } from "vitest";
import { mergeCarts, MAX_QUANTITY } from "../lib/cart-merge";

// When a guest with items logs in, their cart meets the account cart.
// Strategy: additive merge — sum quantities on overlap (capped), union the
// rest — because the guest deliberately added those items this session and
// losing them is the worst outcome. Pure function, hand-computed fixtures.
describe("mergeCarts", () => {
  it("unions disjoint products", () => {
    expect(
      mergeCarts([{ productId: 1, quantity: 2 }], [{ productId: 2, quantity: 3 }]),
    ).toEqual([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 3 },
    ]);
  });

  it("sums quantities when the same product is in both carts", () => {
    expect(
      mergeCarts([{ productId: 1, quantity: 2 }], [{ productId: 1, quantity: 3 }]),
    ).toEqual([{ productId: 1, quantity: 5 }]);
  });

  it("caps a summed quantity at the maximum", () => {
    expect(
      mergeCarts([{ productId: 1, quantity: 90 }], [{ productId: 1, quantity: 20 }]),
    ).toEqual([{ productId: 1, quantity: MAX_QUANTITY }]);
  });

  it("an empty guest cart leaves the user cart untouched", () => {
    expect(mergeCarts([{ productId: 1, quantity: 2 }], [])).toEqual([
      { productId: 1, quantity: 2 },
    ]);
  });

  it("preserves user lines first, then appends guest-only products", () => {
    expect(
      mergeCarts(
        [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }],
        [{ productId: 2, quantity: 1 }, { productId: 3, quantity: 1 }],
      ),
    ).toEqual([
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 2 },
      { productId: 3, quantity: 1 },
    ]);
  });
});
