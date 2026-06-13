import { and, cart, eq, isNull } from "@nordhem/db";
import { cookies } from "next/headers";
import { createCart, getOrCreateUserCart } from "./cart-repo";
import { db } from "./db";
import { getCurrentUser } from "./session";

/** Guest carts are found by this cookie; logged-in carts by the user id (D43). */
export const CART_COOKIE = "nordhem_cart_id";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * The active cart id, or null, WITHOUT side effects — safe to call during
 * render. A logged-in user's cart is keyed by user id; a guest's by the
 * cart_id cookie (and only if that row is genuinely an unclaimed guest cart).
 */
export async function getActiveCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const rows = await db()
      .select({ id: cart.id })
      .from(cart)
      .where(eq(cart.userId, user.id));
    return rows[0]?.id ?? null;
  }
  const cookieId = (await cookies()).get(CART_COOKIE)?.value;
  if (!cookieId) return null;
  const rows = await db()
    .select({ id: cart.id })
    .from(cart)
    .where(and(eq(cart.id, cookieId), isNull(cart.userId)));
  return rows[0]?.id ?? null;
}

/**
 * The active cart id, CREATING one (and setting the guest cookie) if needed.
 * Only callable from a Server Action / Route Handler, since it writes a cookie.
 */
export async function ensureActiveCart(): Promise<string> {
  const user = await getCurrentUser();
  if (user) return (await getOrCreateUserCart(db(), user.id)).id;

  const store = await cookies();
  const cookieId = store.get(CART_COOKIE)?.value;
  if (cookieId) {
    const rows = await db()
      .select({ id: cart.id })
      .from(cart)
      .where(and(eq(cart.id, cookieId), isNull(cart.userId)));
    if (rows[0]) return rows[0].id;
  }

  const created = await createCart(db(), null);
  store.set(CART_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return created.id;
}

/** Forget the guest cart cookie (after it has been merged into a user cart). */
export async function clearGuestCartCookie(): Promise<void> {
  (await cookies()).delete(CART_COOKIE);
}
