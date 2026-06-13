"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";

export interface AccountState {
  error?: string;
}

function messageFrom(err: unknown): string {
  const body = (err as { body?: { message?: string } })?.body;
  if (body?.message) return body.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/**
 * Server Actions for email+password auth. Using a Server Action (not the
 * browser client) means the form works before, and without, hydration:
 * Better Auth's nextCookies plugin sets the session cookie on the response.
 * The guest cart is merged by the session-creation hook in lib/auth.ts, which
 * fires for this path AND for Google, so there is no per-action merge here.
 */
export async function signUpAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const next = String(formData.get("next") || "/");
  try {
    await auth.api.signUpEmail({
      body: {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        name: String(formData.get("name") || ""),
      },
      headers: await headers(),
    });
  } catch (err) {
    return { error: messageFrom(err) };
  }
  redirect(next);
}

export async function signInAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const next = String(formData.get("next") || "/");
  try {
    await auth.api.signInEmail({
      body: {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      },
      headers: await headers(),
    });
  } catch (err) {
    return { error: messageFrom(err) };
  }
  redirect(next);
}
