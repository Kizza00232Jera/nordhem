"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "../../lib/format";
import { useCart } from "../components/cart-provider";

// The full-page cart (the drawer is the quick view; this is the considered
// one). Same optimistic provider state, so it stays in lockstep with the
// drawer and the header badge.
export default function CartPage() {
  const { cart, setQuantity, removeItem } = useCart();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-light">Your cart</h1>

      {cart.items.length === 0 ? (
        <div className="mt-10 rounded-md border border-line bg-card p-10 text-center">
          <p className="text-[15px] text-ink-muted">Your cart is empty.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xs bg-pine px-6 py-3 text-[15px] font-semibold text-white hover:bg-pine-deep"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
          <ul className="divide-y divide-line border-y border-line">
            {cart.items.map((item) => (
              <li key={item.productId} className="flex gap-5 py-5">
                <Link
                  href={`/product/${item.slug}`}
                  className="relative size-28 shrink-0 overflow-hidden rounded-xs bg-linen"
                >
                  {item.imageThumbUrl && (
                    <Image
                      src={item.imageThumbUrl}
                      alt={item.name}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/product/${item.slug}`}
                    className="text-[15px] leading-snug hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="tnum mt-1 text-[15px] font-semibold">
                    {formatPrice(item.unitPriceCents)}
                  </p>
                  <div className="mt-auto flex items-center gap-4 pt-3">
                    <div className="flex items-center rounded-xs border border-line">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.name}`}
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        className="inline-flex size-9 items-center justify-center text-ink-muted hover:text-ink"
                      >
                        <Minus aria-hidden className="size-4" strokeWidth={1.75} />
                      </button>
                      <span className="tnum w-9 text-center text-[14px]" aria-label="Quantity">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        className="inline-flex size-9 items-center justify-center text-ink-muted hover:text-ink"
                      >
                        <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-error"
                    >
                      <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                      Remove
                    </button>
                  </div>
                </div>
                <p className="tnum hidden w-24 text-right text-[15px] font-semibold sm:block">
                  {formatPrice(item.unitPriceCents * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-md border border-line bg-card p-6">
            <h2 className="text-[15px] font-semibold">Summary</h2>
            <dl className="mt-4 space-y-2 text-[14px]">
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
              <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold">
                <dt>Total</dt>
                <dd className="tnum">{formatPrice(cart.totalCents)}</dd>
              </div>
            </dl>
            <Link
              href="/checkout"
              className="mt-5 block rounded-xs bg-pine py-3.5 text-center text-[15px] font-semibold text-white hover:bg-pine-deep"
            >
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
