"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatPrice } from "../../lib/format";
import { useCart } from "./cart-provider";

/**
 * Slide-over cart (drawer, not a page — D nordhem-design). Reads the optimistic
 * cart from the provider, so quantity steps and removals feel instant. Focus
 * is trapped lightly: Esc closes and focus returns; the backdrop closes too.
 */
export function CartDrawer() {
  const { cart, open, setOpen, setQuantity, removeItem } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
    >
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        tabIndex={-1}
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-float outline-none transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-2xl font-light">
            Cart{" "}
            {cart.itemCount > 0 && (
              <span className="text-ink-muted">({cart.itemCount})</span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close cart"
            className="inline-flex size-10 items-center justify-center rounded-xs text-ink-muted hover:text-ink"
          >
            <X aria-hidden className="size-5" strokeWidth={1.75} />
          </button>
        </header>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag aria-hidden className="size-10 text-ink-muted" strokeWidth={1.25} />
            <p className="text-[15px] text-ink-muted">Your cart is empty.</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xs border border-line px-5 py-2.5 text-[14px] font-medium hover:border-ink"
            >
              Keep shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {cart.items.map((item) => (
                <li key={item.productId} className="flex gap-4 py-4">
                  <Link
                    href={`/product/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className="relative size-20 shrink-0 overflow-hidden rounded-xs bg-linen"
                  >
                    {item.imageThumbUrl && (
                      <Image
                        src={item.imageThumbUrl}
                        alt={item.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={() => setOpen(false)}
                      className="line-clamp-2 text-[14px] leading-snug hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="tnum mt-1 text-[14px] font-semibold">
                      {formatPrice(item.unitPriceCents)}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-xs border border-line">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() => setQuantity(item.productId, item.quantity - 1)}
                          className="inline-flex size-8 items-center justify-center text-ink-muted hover:text-ink"
                        >
                          <Minus aria-hidden className="size-4" strokeWidth={1.75} />
                        </button>
                        <span className="tnum w-8 text-center text-[14px]" aria-label="Quantity">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={() => setQuantity(item.productId, item.quantity + 1)}
                          className="inline-flex size-8 items-center justify-center text-ink-muted hover:text-ink"
                        >
                          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeItem(item.productId)}
                        className="inline-flex size-8 items-center justify-center text-ink-muted hover:text-error"
                      >
                        <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-line px-5 py-4">
              <dl className="space-y-1.5 text-[14px]">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Subtotal</dt>
                  <dd className="tnum">{formatPrice(cart.subtotalCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Shipping</dt>
                  <dd className="tnum">
                    {cart.shippingCents === 0 ? "Free" : formatPrice(cart.shippingCents)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold">
                  <dt>Total</dt>
                  <dd className="tnum">{formatPrice(cart.totalCents)}</dd>
                </div>
              </dl>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="mt-4 block rounded-xs bg-pine py-3.5 text-center text-[15px] font-semibold text-white hover:bg-pine-deep"
              >
                Checkout
              </Link>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
