import {
  cartItems,
  eq,
  productImages,
  productsRaw,
  shopProducts,
  type DbOrTx,
} from "@nordhem/db";
import type { CartView } from "@nordhem/shared";
import { cartTotals } from "./cart-totals";

const EMPTY: CartView = {
  items: [],
  itemCount: 0,
  subtotalCents: 0,
  shippingCents: 0,
  totalCents: 0,
};

/**
 * The cart as the UI renders it: each line joined to the LIVE catalog (price,
 * name, image) — never a snapshot, that is only for orders — plus totals from
 * the same cartTotals() the checkout uses. A null/empty cart yields the empty
 * view so callers never branch on it.
 */
export async function getCartView(
  db: DbOrTx,
  cartId: string | null,
): Promise<CartView> {
  if (!cartId) return EMPTY;

  const rows = await db
    .select({
      productId: cartItems.productId,
      name: productsRaw.name,
      slug: shopProducts.slug,
      imageThumbUrl: productImages.thumbUrl,
      unitPriceCents: shopProducts.priceCents,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(shopProducts, eq(shopProducts.productId, cartItems.productId))
    .innerJoin(productsRaw, eq(productsRaw.productId, cartItems.productId))
    .leftJoin(productImages, eq(productImages.productId, cartItems.productId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.productId);

  if (rows.length === 0) return EMPTY;

  const totals = cartTotals(rows);
  const itemCount = rows.reduce((n, r) => n + r.quantity, 0);
  return { items: rows, itemCount, ...totals };
}
