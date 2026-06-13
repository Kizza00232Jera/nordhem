import { describe, expect, it } from "vitest";
import { AddressSchema, CartViewSchema, OrderSummarySchema } from "../src/index.ts";

// These contracts are validated at the Server Action boundary — the form post
// is untrusted input. The address rules carry the real logic, so they get the
// real tests; the cart/order views are asserted as round-trippable shapes.
describe("AddressSchema", () => {
  const valid = {
    fullName: "Astrid Lindgren",
    line1: "Storgata 1",
    line2: null,
    city: "Oslo",
    postalCode: "0155",
    country: "NO",
  };

  it("accepts a complete address (line2 optional/nullable)", () => {
    expect(AddressSchema.parse(valid)).toMatchObject({ city: "Oslo" });
    expect(AddressSchema.parse({ ...valid, line2: "Apt 4" }).line2).toBe("Apt 4");
  });

  it("rejects a blank required field", () => {
    expect(AddressSchema.safeParse({ ...valid, fullName: "" }).success).toBe(false);
    expect(AddressSchema.safeParse({ ...valid, city: "  " }).success).toBe(false);
  });

  it("rejects a country that is not a 2-letter code", () => {
    expect(AddressSchema.safeParse({ ...valid, country: "Norway" }).success).toBe(false);
  });
});

describe("CartViewSchema", () => {
  it("parses a cart view with totals and lines", () => {
    const view = {
      items: [
        {
          productId: 1,
          name: "Oak bed",
          slug: "oak-bed-1",
          imageThumbUrl: "https://img.test/x.jpg",
          unitPriceCents: 62999,
          quantity: 1,
        },
      ],
      itemCount: 1,
      subtotalCents: 62999,
      shippingCents: 0,
      totalCents: 62999,
    };
    expect(CartViewSchema.parse(view).items).toHaveLength(1);
  });
});

describe("OrderSummarySchema", () => {
  it("parses a placed-order summary with snapshotted lines", () => {
    const summary = {
      id: "11111111-1111-1111-1111-111111111111",
      orderNumber: "NDH-2026-000001",
      subtotalCents: 12999,
      shippingCents: 4900,
      totalCents: 17899,
      items: [
        {
          productId: 3,
          nameSnapshot: "Wool rug",
          slugSnapshot: "wool-rug-3",
          imageUrlSnapshot: null,
          unitPriceCents: 12999,
          quantity: 1,
        },
      ],
    };
    expect(OrderSummarySchema.parse(summary).orderNumber).toBe("NDH-2026-000001");
  });
});
