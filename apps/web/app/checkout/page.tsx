import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCartId } from "../../lib/cart-session";
import { getCartView } from "../../lib/cart-view";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { CheckoutForm } from "../components/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  // Checkout requires an account (the order must belong to someone, D43).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");

  const cart = await getCartView(db(), await getActiveCartId());

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-light">Checkout</h1>

      {cart.items.length === 0 ? (
        <div className="mt-10 rounded-md border border-line bg-card p-10 text-center">
          <p className="text-[15px] text-ink-muted">
            Your cart is empty, so there is nothing to check out.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xs bg-pine px-6 py-3 text-[15px] font-semibold text-white hover:bg-pine-deep"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <CheckoutForm cart={cart} />
        </div>
      )}
    </main>
  );
}
