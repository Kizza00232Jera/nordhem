import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "../app/components/favorite-button";
import type { ToggleFavoriteResult } from "../app/actions/favorites";

// A promise the test resolves by hand, so we can observe the optimistic state
// WHILE the action is in flight, then assert what happens when it settles.
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("FavoriteButton optimistic behaviour", () => {
  it("flips immediately on click and keeps the state when the action confirms", async () => {
    const user = userEvent.setup();
    const d = deferred<ToggleFavoriteResult>();
    const action = vi.fn(() => d.promise);
    render(<FavoriteButton productId={1} initialFavorited={false} action={action} />);

    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");

    await user.click(btn);
    // Optimistic apply: filled before the server answers.
    expect(btn).toHaveAttribute("aria-pressed", "true");

    await act(async () => {
      d.resolve({ ok: true, favorited: true });
    });
    await waitFor(() => expect(btn).toHaveAttribute("aria-pressed", "true"));
    expect(action).toHaveBeenCalledWith(1);
  });

  it("rolls back when the action reports the user is signed out", async () => {
    const user = userEvent.setup();
    const d = deferred<ToggleFavoriteResult>();
    const action = vi.fn(() => d.promise);
    const onAuthRequired = vi.fn();
    render(
      <FavoriteButton
        productId={2}
        initialFavorited={false}
        action={action}
        onAuthRequired={onAuthRequired}
      />,
    );

    const btn = screen.getByRole("button");
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true"); // optimistic flip

    await act(async () => {
      d.resolve({ ok: false });
    });

    // Rollback: the flip is discarded because we never adopted it.
    await waitFor(() => expect(btn).toHaveAttribute("aria-pressed", "false"));
    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });
});
