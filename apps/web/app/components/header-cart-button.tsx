"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";

/** The header bag icon: opens the drawer, shows a live item-count badge. */
export function HeaderCartButton() {
  const { cart, setOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative inline-flex size-11 items-center justify-center text-ink-muted hover:text-ink"
      aria-label={`Cart, ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`}
    >
      <ShoppingBag aria-hidden className="size-5" strokeWidth={1.75} />
      {cart.itemCount > 0 && (
        <span className="tnum absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-pine px-1 text-[11px] font-semibold leading-5 text-white">
          {cart.itemCount}
        </span>
      )}
    </button>
  );
}
