import type { CartView } from "@nordhem/shared";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// The cart provider calls Server Actions that import server-only modules
// (next/headers, the db). Mock that module so the optimistic client logic can
// be tested in jsdom without dragging the server in.
const { addMock } = vi.hoisted(() => ({ addMock: vi.fn() }));
vi.mock("../app/actions/cart", () => ({
  addToCartAction: addMock,
  updateQuantityAction: vi.fn(),
  removeFromCartAction: vi.fn(),
  getCartViewAction: vi.fn(),
}));

import { CartProvider, useCart } from "../app/components/cart-provider";
import { CartDrawer } from "../app/components/cart-drawer";

const EMPTY: CartView = {
  items: [],
  itemCount: 0,
  subtotalCents: 0,
  shippingCents: 0,
  totalCents: 0,
};

const LINE = {
  productId: 1,
  name: "Oak bed",
  slug: "oak-bed-1",
  imageThumbUrl: null,
  unitPriceCents: 62999,
  quantity: 1,
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function AddButton() {
  const { addItem } = useCart();
  return <button onClick={() => addItem(LINE)}>add to cart</button>;
}

function renderCart() {
  return render(
    <CartProvider initialCart={EMPTY}>
      <AddButton />
      <CartDrawer />
    </CartProvider>,
  );
}

describe("cart optimistic add", () => {
  it("shows the line immediately and keeps it when the action confirms", async () => {
    const user = userEvent.setup();
    const d = deferred<CartView>();
    addMock.mockReturnValueOnce(d.promise);
    renderCart();

    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    // Optimistic: the line is in the drawer before the server responds.
    expect(screen.getByText("Oak bed")).toBeInTheDocument();

    const authoritative: CartView = {
      items: [LINE],
      itemCount: 1,
      subtotalCents: 62999,
      shippingCents: 0,
      totalCents: 62999,
    };
    await act(async () => {
      d.resolve(authoritative);
    });
    await waitFor(() => expect(screen.getByText("Oak bed")).toBeInTheDocument());
  });

  it("rolls the line back out when the action fails", async () => {
    const user = userEvent.setup();
    const d = deferred<CartView>();
    addMock.mockReturnValueOnce(d.promise);
    renderCart();

    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(screen.getByText("Oak bed")).toBeInTheDocument(); // optimistic

    await act(async () => {
      d.reject(new Error("network"));
    });

    // Rollback: the line is gone and the empty state returns.
    await waitFor(() =>
      expect(screen.queryByText("Oak bed")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });
});
