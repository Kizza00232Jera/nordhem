"use client";

import type { CartLineView } from "@nordhem/shared";
import { Check, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useCart } from "./cart-provider";

/**
 * Adds a product to the cart (optimistically, via the cart provider) and opens
 * the drawer. Briefly confirms with a checkmark so the click feels acknowledged
 * even though the drawer also opens.
 */
export function AddToCartButton({
  line,
  compact = false,
  className = "",
}: {
  line: CartLineView;
  /** A small icon-only button for product cards (vs. the full PDP button). */
  compact?: boolean;
  className?: string;
}) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  function onClick() {
    addItem(line);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Add ${line.name} to cart`}
        className={`inline-flex size-10 items-center justify-center rounded-full bg-card text-ink shadow-lift transition-colors duration-150 hover:bg-pine hover:text-white ${className}`}
      >
        {justAdded ? (
          <Check aria-hidden className="size-5" strokeWidth={2} />
        ) : (
          <ShoppingBag aria-hidden className="size-5" strokeWidth={1.75} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xs bg-pine px-6 py-3.5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-pine-deep ${className}`}
    >
      {justAdded ? (
        <>
          <Check aria-hidden className="size-5" strokeWidth={2} />
          Added
        </>
      ) : (
        <>
          <ShoppingBag aria-hidden className="size-5" strokeWidth={1.75} />
          Add to cart
        </>
      )}
    </button>
  );
}
