import {
  cartItems,
  eq,
  orderItems,
  orders,
  productImages,
  productsRaw,
  shopProducts,
  sql,
  type Db,
} from "@nordhem/db";
import { cartTotals } from "./cart-totals";

export class EmptyCartError extends Error {
  constructor() {
    super("Cannot check out an empty cart");
    this.name = "EmptyCartError";
  }
}

export interface CheckoutAddress {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  country: string;
}

export interface CheckoutParams {
  userId: string;
  cartId: string;
  address: CheckoutAddress;
}

export interface CheckoutOptions {
  /**
   * Runs inside the transaction after the order is written but before commit:
   * the seam where real payment authorization would happen. If it throws, the
   * whole transaction rolls back — no order, cart intact.
   */
  beforeCommit?: () => Promise<void>;
}

export interface OrderItemView {
  productId: number;
  nameSnapshot: string;
  slugSnapshot: string;
  imageUrlSnapshot: string | null;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  items: OrderItemView[];
}

/**
 * Place an order from a cart, atomically (D44). One transaction: read the cart
 * joined to the live catalog, snapshot every line (name/slug/image/price) so
 * history never re-derives from the present, write order + items, clear the
 * cart. Totals come from the same cartTotals() the UI uses. The order number
 * is drawn from a Postgres sequence and rendered NDH-YYYY-NNNNNN.
 */
export async function checkout(
  db: Db,
  { userId, cartId, address }: CheckoutParams,
  { beforeCommit }: CheckoutOptions = {},
): Promise<OrderSummary> {
  return db.transaction(async (tx) => {
    const lines = await tx
      .select({
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        nameSnapshot: productsRaw.name,
        slugSnapshot: shopProducts.slug,
        unitPriceCents: shopProducts.priceCents,
        imageUrlSnapshot: productImages.url,
      })
      .from(cartItems)
      .innerJoin(shopProducts, eq(shopProducts.productId, cartItems.productId))
      .innerJoin(productsRaw, eq(productsRaw.productId, cartItems.productId))
      .leftJoin(productImages, eq(productImages.productId, cartItems.productId))
      .where(eq(cartItems.cartId, cartId))
      .orderBy(cartItems.productId);

    if (lines.length === 0) throw new EmptyCartError();

    const totals = cartTotals(lines);
    const orderNumber = await nextOrderNumber(tx);

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId,
        shipFullName: address.fullName,
        shipLine1: address.line1,
        shipLine2: address.line2,
        shipCity: address.city,
        shipPostalCode: address.postalCode,
        shipCountry: address.country,
        subtotalCents: totals.subtotalCents,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
      })
      .returning({ id: orders.id });

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        nameSnapshot: l.nameSnapshot,
        slugSnapshot: l.slugSnapshot,
        imageUrlSnapshot: l.imageUrlSnapshot,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
      })),
    );

    // Payment authorization seam — a throw here rolls the order back.
    if (beforeCommit) await beforeCommit();

    await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));

    return {
      id: order.id,
      orderNumber,
      subtotalCents: totals.subtotalCents,
      shippingCents: totals.shippingCents,
      totalCents: totals.totalCents,
      items: lines,
    };
  });
}

/** NDH-YYYY-NNNNNN, the number zero-padded from order_number_seq. */
async function nextOrderNumber(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
): Promise<string> {
  const rows = await tx.execute<{ n: number }>(
    sql`SELECT nextval('order_number_seq') AS n`,
  );
  const seq = Number(rows[0].n);
  const year = new Date().getFullYear();
  return `NDH-${year}-${String(seq).padStart(6, "0")}`;
}
