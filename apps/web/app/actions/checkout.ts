"use server";

import { AddressSchema } from "@nordhem/shared";
import { redirect } from "next/navigation";
import { getActiveCartId } from "../../lib/cart-session";
import { checkout, EmptyCartError } from "../../lib/checkout-repo";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";

export interface CheckoutState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Place the order (useActionState form action). Verifies the session inside
 * the action (a Server Action is a public POST endpoint), validates the
 * address against the zod contract, then runs the atomic checkout and
 * redirects to the order confirmation. redirect() throws, so it lives outside
 * the try/catch.
 */
export async function checkoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");

  const parsed = AddressSchema.safeParse({
    fullName: formData.get("fullName"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || null,
    city: formData.get("city"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  let orderNumber: string;
  try {
    const cartId = await getActiveCartId();
    const order = await checkout(db(), {
      userId: user.id,
      cartId: cartId ?? "",
      address: parsed.data,
    });
    orderNumber = order.orderNumber;
  } catch (err) {
    if (err instanceof EmptyCartError) {
      return { error: "Your cart is empty." };
    }
    throw err;
  }

  redirect(`/orders/${orderNumber}?placed=1`);
}
