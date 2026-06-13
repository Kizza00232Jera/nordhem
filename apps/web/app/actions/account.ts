"use server";

import { and, cart, eq, isNull } from "@nordhem/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { mergeGuestCartIntoUser } from "../../lib/cart-repo";
import { CART_COOKIE } from "../../lib/cart-session";
import { db } from "../../lib/db";

export interface AccountState {
  error?: string;
}

/** Fold a freshly-known user's guest cart in. The session cookie was just set
 * on the response, so the request still reads as a guest — merge by the user
 * id we already have, not by re-reading the session. */
async function mergeGuestFor(userId: string): Promise<void> {
  const store = await cookies();
  const guestId = store.get(CART_COOKIE)?.value;
  if (!guestId) return;
  const guestRows = await db()
    .select({ id: cart.id })
    .from(cart)
    .where(and(eq(cart.id, guestId), isNull(cart.userId)));
  if (guestRows[0]) await mergeGuestCartIntoUser(db(), guestId, userId);
  store.delete(CART_COOKIE);
}

function messageFrom(err: unknown): string {
  const body = (err as { body?: { message?: string } })?.body;
  if (body?.message) return body.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/**
 * Server Actions for email+password auth. Using a Server Action (not the
 * browser client) means the form works before — and without — hydration:
 * Better Auth's nextCookies plugin sets the session cookie on the response,
 * we merge the guest cart by the returned user id, then redirect.
 */
export async function signUpAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const next = String(formData.get("next") || "/");
  let userId: string;
  try {
    const res = await auth.api.signUpEmail({
      body: {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        name: String(formData.get("name") || ""),
      },
      headers: await headers(),
    });
    userId = res.user.id;
  } catch (err) {
    return { error: messageFrom(err) };
  }
  await mergeGuestFor(userId);
  redirect(next);
}

export async function signInAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const next = String(formData.get("next") || "/");
  let userId: string;
  try {
    const res = await auth.api.signInEmail({
      body: {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      },
      headers: await headers(),
    });
    userId = res.user.id;
  } catch (err) {
    return { error: messageFrom(err) };
  }
  await mergeGuestFor(userId);
  redirect(next);
}
