"use client";

import type { CartLineView, CartView } from "@nordhem/shared";
import {
  createContext,
  startTransition,
  useContext,
  useOptimistic,
  useState,
} from "react";
import {
  addToCartAction,
  removeFromCartAction,
  updateQuantityAction,
} from "../actions/cart";
import { MAX_QUANTITY } from "../../lib/cart-merge";
import { cartTotals } from "../../lib/cart-totals";

interface CartContextValue {
  cart: CartView;
  open: boolean;
  setOpen: (open: boolean) => void;
  addItem: (line: CartLineView) => void;
  setQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Derive a full CartView (totals + count) from a set of lines. */
function recompute(items: CartLineView[]): CartView {
  return {
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    ...cartTotals(items),
  };
}

type Patch =
  | { type: "add"; line: CartLineView }
  | { type: "setQuantity"; productId: number; quantity: number }
  | { type: "remove"; productId: number };

function reducer(view: CartView, patch: Patch): CartView {
  switch (patch.type) {
    case "add": {
      const existing = view.items.find((i) => i.productId === patch.line.productId);
      const items = existing
        ? view.items.map((i) =>
            i.productId === patch.line.productId
              ? { ...i, quantity: Math.min(i.quantity + 1, MAX_QUANTITY) }
              : i,
          )
        : [...view.items, { ...patch.line, quantity: 1 }];
      return recompute(items);
    }
    case "setQuantity": {
      const items =
        patch.quantity <= 0
          ? view.items.filter((i) => i.productId !== patch.productId)
          : view.items.map((i) =>
              i.productId === patch.productId
                ? { ...i, quantity: Math.min(patch.quantity, MAX_QUANTITY) }
                : i,
            );
      return recompute(items);
    }
    case "remove":
      return recompute(view.items.filter((i) => i.productId !== patch.productId));
  }
}

/**
 * Cart state for the header badge and drawer. Optimistic by design: a mutation
 * patches the rendered view immediately, fires the Server Action, and replaces
 * the view with the authoritative one it returns. If the action throws,
 * useOptimistic discards the patch and the view snaps back — instant feedback,
 * honest reconciliation.
 */
export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: CartView;
  children: React.ReactNode;
}) {
  const [authCart, setAuthCart] = useState(initialCart);
  const [cart, applyPatch] = useOptimistic(authCart, reducer);
  const [open, setOpen] = useState(false);

  function run(patch: Patch, server: () => Promise<CartView>) {
    startTransition(async () => {
      applyPatch(patch);
      try {
        setAuthCart(await server());
      } catch {
        // The action failed: leave authCart untouched so useOptimistic
        // discards the patch and the cart snaps back to the last good state.
      }
    });
  }

  const value: CartContextValue = {
    cart,
    open,
    setOpen,
    addItem: (line) => {
      setOpen(true);
      run({ type: "add", line }, () => addToCartAction(line.productId, 1));
    },
    setQuantity: (productId, quantity) =>
      run({ type: "setQuantity", productId, quantity }, () =>
        updateQuantityAction(productId, quantity),
      ),
    removeItem: (productId) =>
      run({ type: "remove", productId }, () => removeFromCartAction(productId)),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
