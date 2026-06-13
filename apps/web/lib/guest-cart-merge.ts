import { and, cart, eq, isNull } from "@nordhem/db";
import { cookies } from "next/headers";
import { mergeGuestCartIntoUser } from "./cart-repo";
import { db } from "./db";

/** Guest carts are found by this cookie; logged-in carts by the user id (D43). */
export const CART_COOKIE = "nordhem_cart_id";

/**
 * Fold a just-authenticated user's guest cart into their account cart, then
 * forget the cookie. Called from a Better Auth session-creation hook, so it
 * runs for EVERY login path (email/password AND Google), which the old
 * action-only merge missed. Defensive: a cart merge must never break login,
 * so any failure is swallowed.
 */
export async function mergeGuestCartForUser(userId: string): Promise<void> {
  try {
    const store = await cookies();
    const guestId = store.get(CART_COOKIE)?.value;
    if (!guestId) return;
    const guestRows = await db()
      .select({ id: cart.id })
      .from(cart)
      .where(and(eq(cart.id, guestId), isNull(cart.userId)));
    if (guestRows[0]) await mergeGuestCartIntoUser(db(), guestId, userId);
    store.delete(CART_COOKIE);
  } catch {
    // Never let a guest-cart merge failure break the sign-in itself.
  }
}
