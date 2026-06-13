import { and, cart, cartItems, eq, sql, type Db, type DbOrTx } from "@nordhem/db";
import { MAX_QUANTITY, mergeCarts } from "./cart-merge";

export interface CartRef {
  id: string;
}

export interface CartLine {
  productId: number;
  quantity: number;
}

/** Create a cart. userId null = a guest cart (found later by the cart_id cookie). */
export async function createCart(
  db: DbOrTx,
  userId: string | null,
): Promise<CartRef> {
  const [row] = await db
    .insert(cart)
    .values({ userId })
    .returning({ id: cart.id });
  return row;
}

/** The user's one cart (D43), created on first use. */
export async function getOrCreateUserCart(
  db: DbOrTx,
  userId: string,
): Promise<CartRef> {
  const existing = await db
    .select({ id: cart.id })
    .from(cart)
    .where(eq(cart.userId, userId));
  if (existing.length > 0) return existing[0];
  return createCart(db, userId);
}

/** Cart lines in stable product order — the read seam used everywhere. */
export async function getCartLines(
  db: DbOrTx,
  cartId: string,
): Promise<CartLine[]> {
  return db
    .select({ productId: cartItems.productId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.productId);
}

/**
 * Add a product (default qty 1). One line per product is a pk invariant, so
 * this is an upsert: a new product inserts, an existing one accumulates, and
 * the total is capped at MAX_QUANTITY in SQL so two concurrent adds can't
 * overshoot.
 */
export async function addToCart(
  db: DbOrTx,
  cartId: string,
  productId: number,
  quantity = 1,
): Promise<void> {
  await db
    .insert(cartItems)
    .values({ cartId, productId, quantity: Math.min(quantity, MAX_QUANTITY) })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: {
        quantity: sql`LEAST(${cartItems.quantity} + ${quantity}, ${MAX_QUANTITY})`,
      },
    });
}

/** Set an absolute quantity; a quantity of 0 or less removes the line. */
export async function setQuantity(
  db: DbOrTx,
  cartId: string,
  productId: number,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await removeFromCart(db, cartId, productId);
    return;
  }
  await db
    .insert(cartItems)
    .values({ cartId, productId, quantity: Math.min(quantity, MAX_QUANTITY) })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: { quantity: Math.min(quantity, MAX_QUANTITY) },
    });
}

export async function removeFromCart(
  db: DbOrTx,
  cartId: string,
  productId: number,
): Promise<void> {
  await db
    .delete(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
}

/**
 * Merge a guest cart into the user's cart on login (D43), then delete the
 * guest row (its items cascade away). The additive rule lives in the pure
 * mergeCarts(); here we just load both sides, apply it, and write the result
 * as absolute quantities. Wrapped in a transaction so a partial merge can
 * never strand items in two carts.
 */
export async function mergeGuestCartIntoUser(
  db: Db,
  guestCartId: string,
  userId: string,
): Promise<CartRef> {
  return db.transaction(async (tx) => {
    const userCart = await getOrCreateUserCart(tx, userId);
    if (userCart.id === guestCartId) return userCart;

    const merged = mergeCarts(
      await getCartLines(tx, userCart.id),
      await getCartLines(tx, guestCartId),
    );
    for (const line of merged) {
      await setQuantity(tx, userCart.id, line.productId, line.quantity);
    }
    await tx.delete(cart).where(eq(cart.id, guestCartId));
    return userCart;
  });
}
