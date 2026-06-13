import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchCombobox } from "../app/components/search-combobox";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

const SUGGESTIONS = {
  query: "vel",
  tookMs: 2,
  suggestions: [
    {
      id: "2",
      name: "velvet accent chair",
      slug: "velvet-accent-chair-2",
      priceCents: 49999,
      imageThumbUrl: null,
    },
    {
      id: "9",
      name: "velvet ottoman",
      slug: "velvet-ottoman-9",
      priceCents: 19999,
      imageThumbUrl: null,
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(SUGGESTIONS)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe("SearchCombobox", () => {
  it("shows suggestions after typing, with one debounced request", async () => {
    const user = userEvent.setup();
    render(<SearchCombobox />);

    await user.type(
      screen.getByRole("combobox", { name: /search products/i }),
      "vel",
    );

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("velvet accent chair"),
      expect.stringContaining("velvet ottoman"),
    ]);
    // 3 keystrokes, one request: the debounce did its job.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/autocomplete?q=vel",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("ArrowDown walks the options and Enter opens the highlighted product", async () => {
    const user = userEvent.setup();
    render(<SearchCombobox />);
    const input = screen.getByRole("combobox", { name: /search products/i });
    await user.type(input, "vel");
    await screen.findAllByRole("option");

    await user.keyboard("{ArrowDown}");
    const first = screen.getAllByRole("option")[0]!;
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", first.id);

    await user.keyboard("{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/product/velvet-ottoman-9");
  });

  it("Escape closes the listbox and keeps focus in the input", async () => {
    const user = userEvent.setup();
    render(<SearchCombobox />);
    const input = screen.getByRole("combobox", { name: /search products/i });
    await user.type(input, "vel");
    await screen.findAllByRole("option");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("Enter with no highlighted option searches the typed text", async () => {
    const user = userEvent.setup();
    render(<SearchCombobox />);
    await user.type(
      screen.getByRole("combobox", { name: /search products/i }),
      "vel",
    );
    await screen.findAllByRole("option");

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/search?q=vel");
  });

  it("initializes the input from the URL's q param", () => {
    searchParams = new URLSearchParams("q=oak bed");
    render(<SearchCombobox />);

    expect(
      screen.getByRole("combobox", { name: /search products/i }),
    ).toHaveValue("oak bed");
  });
});
