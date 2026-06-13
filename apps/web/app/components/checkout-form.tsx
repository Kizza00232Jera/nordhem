"use client";

import type { CartView } from "@nordhem/shared";
import { Lock } from "lucide-react";
import { useActionState } from "react";
import { checkoutAction, type CheckoutState } from "../actions/checkout";
import { formatPrice } from "../../lib/format";

/**
 * Single calm checkout page (nordhem-design): an address form with real
 * autocomplete attributes and a clearly-labelled demo payment, plus the order
 * summary. Submits to the checkoutAction Server Action via useActionState, so
 * validation errors come back inline without losing the typed values.
 */
export function CheckoutForm({ cart }: { cart: CartView }) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    checkoutAction,
    {},
  );

  return (
    <form action={formAction} className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div>
        <h2 className="text-[15px] font-semibold">Shipping address</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            name="fullName"
            autoComplete="name"
            className="sm:col-span-2"
            error={state.fieldErrors?.fullName}
          />
          <Field
            label="Address"
            name="line1"
            autoComplete="address-line1"
            className="sm:col-span-2"
            error={state.fieldErrors?.line1}
          />
          <Field
            label="Apartment, suite (optional)"
            name="line2"
            autoComplete="address-line2"
            className="sm:col-span-2"
            required={false}
          />
          <Field
            label="City"
            name="city"
            autoComplete="address-level2"
            error={state.fieldErrors?.city}
          />
          <Field
            label="Postal code"
            name="postalCode"
            autoComplete="postal-code"
            error={state.fieldErrors?.postalCode}
          />
          <Field
            label="Country (2-letter code)"
            name="country"
            autoComplete="country"
            defaultValue="NO"
            maxLength={2}
            error={state.fieldErrors?.country}
          />
        </div>

        <h2 className="mt-10 text-[15px] font-semibold">Payment</h2>
        <p className="mt-3 flex items-start gap-2 rounded-xs bg-linen px-4 py-3 text-[13px] text-ink-muted">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          Demo store — no real payment is taken. Placing the order records it in
          your account so you can see the full flow.
        </p>

        {state.error && (
          <p role="alert" className="mt-4 text-[14px] text-error">
            {state.error}
          </p>
        )}
      </div>

      <aside className="h-fit rounded-md border border-line bg-card p-6">
        <h2 className="text-[15px] font-semibold">Order summary</h2>
        <ul className="mt-4 space-y-2 text-[14px]">
          {cart.items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-ink-muted">
                {item.quantity} × {item.name}
              </span>
              <span className="tnum shrink-0">
                {formatPrice(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[14px]">
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
        <button
          type="submit"
          disabled={pending}
          className="mt-5 block w-full rounded-xs bg-pine py-3.5 text-center text-[15px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
        >
          {pending ? "Placing order…" : "Place order"}
        </button>
      </aside>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  className = "",
  required = true,
  ...props
}: {
  label: string;
  name: string;
  error?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[14px] font-medium">{label}</span>
      <input
        name={name}
        required={required}
        {...props}
        aria-invalid={error ? true : undefined}
        className="h-11 w-full rounded-xs border border-line bg-card px-3.5 text-[15px] aria-[invalid]:border-error"
      />
      {error && <span className="mt-1 block text-[13px] text-error">{error}</span>}
    </label>
  );
}
