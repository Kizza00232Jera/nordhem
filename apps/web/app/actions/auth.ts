"use server";

import { and, cart, eq, isNull } from "@nordhem/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { mergeGuestCartIntoUser } from "../../lib/cart-repo";
import { CART_COOKIE, clearGuestCartCookie } from "../../lib/cart-session";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";

/**
 * Run right after a successful client-side sign-in/sign-up: if the visitor had
 * a guest cart, fold it into their account cart (D43) and forget the cookie.
 * Safe to call when there is nothing to merge.
 */
export async function mergeGuestCartAfterLoginAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const guestId = (await cookies()).get(CART_COOKIE)?.value;
  if (guestId) {
    const guestRows = await db()
      .select({ id: cart.id })
      .from(cart)
      .where(and(eq(cart.id, guestId), isNull(cart.userId)));
    if (guestRows[0]) {
      await mergeGuestCartIntoUser(db(), guestId, user.id);
    }
    await clearGuestCartCookie();
  }
  revalidatePath("/cart");
}
