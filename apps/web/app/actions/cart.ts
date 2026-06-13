"use server";

import type { CartView } from "@nordhem/shared";
import { revalidatePath } from "next/cache";
import { addToCart, removeFromCart, setQuantity } from "../../lib/cart-repo";
import { ensureActiveCart, getActiveCartId } from "../../lib/cart-session";
import { getCartView } from "../../lib/cart-view";
import { db } from "../../lib/db";

// Cart mutations. Each returns the authoritative CartView so the optimistic
// client can reconcile, and revalidates the cart surfaces. No auth gate: a
// guest cart is a first-class cart (D43).

export async function addToCartAction(
  productId: number,
  quantity = 1,
): Promise<CartView> {
  const cartId = await ensureActiveCart();
  await addToCart(db(), cartId, productId, quantity);
  revalidatePath("/cart");
  return getCartView(db(), cartId);
}

export async function updateQuantityAction(
  productId: number,
  quantity: number,
): Promise<CartView> {
  const cartId = await getActiveCartId();
  if (!cartId) return getCartView(db(), null);
  await setQuantity(db(), cartId, productId, quantity);
  revalidatePath("/cart");
  return getCartView(db(), cartId);
}

export async function removeFromCartAction(productId: number): Promise<CartView> {
  const cartId = await getActiveCartId();
  if (!cartId) return getCartView(db(), null);
  await removeFromCart(db(), cartId, productId);
  revalidatePath("/cart");
  return getCartView(db(), cartId);
}

export async function getCartViewAction(): Promise<CartView> {
  return getCartView(db(), await getActiveCartId());
}
