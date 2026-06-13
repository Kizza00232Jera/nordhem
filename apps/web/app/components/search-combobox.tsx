"use client";

import {
  AutocompleteResponseSchema,
  type AutocompleteSuggestion,
} from "@nordhem/shared";
import { Search } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { formatPrice } from "../../lib/format";

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

/**
 * ARIA combobox over /api/autocomplete (WAI-ARIA combobox pattern with a
 * listbox popup). Free-text Enter searches; picking a suggestion goes
 * straight to the product. The input is URL-synced: it reflects ?q= on
 * /search and survives back/forward navigation.
 */
export function SearchCombobox() {
  const router = useRouter();
  const urlQuery = useSearchParams().get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  // Back/forward navigation changes ?q= — the input follows the URL.
  // State is adjusted during render (the react.dev "you might not need an
  // effect" pattern), not in an effect, to avoid a cascading re-render.
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (prevUrlQuery !== urlQuery) {
    setPrevUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function onValueChange(next: string) {
    setValue(next);
    clearTimeout(debounceRef.current);
    if (next.trim().length < MIN_CHARS) {
      abortRef.current?.abort();
      setSuggestions([]);
      close();
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(next.trim())}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = AutocompleteResponseSchema.parse(await res.json());
        setSuggestions(data.suggestions);
        setOpen(data.suggestions.length > 0);
        setActiveIndex(-1);
      } catch {
        // Aborted by newer input, or the search service is asleep — the
        // combobox stays quiet either way; /search degrades honestly.
      }
    }, DEBOUNCE_MS);
  }

  function submitSearch() {
    const query = value.trim();
    if (!query) return;
    close();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function selectSuggestion(suggestion: AutocompleteSuggestion) {
    close();
    if (suggestion.slug) {
      router.push(`/product/${suggestion.slug}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(suggestion.name)}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && activeIndex >= 0) {
      // A highlighted option wins over form submission; free-text Enter
      // falls through to the form's onSubmit.
      e.preventDefault();
      const active = suggestions[activeIndex];
      if (active) selectSuggestion(active);
    } else if (e.key === "Escape") {
      close();
    }
  }

  return (
    <form
      action="/search"
      className="relative mx-auto w-full max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch();
      }}
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
        strokeWidth={1.75}
      />
      <input
        type="text"
        name="q"
        role="combobox"
        placeholder="Search beds, sofas, lighting…"
        aria-label="Search products"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={close}
        className="h-11 w-full rounded-xs border border-line bg-card pl-11 pr-4 text-[15px] placeholder:text-ink-muted"
      />

      {open && (
        <ul
          role="listbox"
          id={listboxId}
          aria-label="Product suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border border-line bg-card py-1.5 shadow-float"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown fires before the input's blur — preventDefault
              // keeps focus so the click can complete the selection.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
              className={`flex h-12 cursor-pointer items-center gap-3 px-3.5 ${
                i === activeIndex ? "bg-linen" : ""
              }`}
            >
              <span className="relative size-9 shrink-0 overflow-hidden rounded-xs bg-linen">
                {s.imageThumbUrl && (
                  <Image
                    src={s.imageThumbUrl}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                )}
              </span>
              <span className="line-clamp-1 flex-1 text-[14px]">{s.name}</span>
              {s.priceCents !== undefined && (
                <span className="tnum text-[14px] font-semibold">
                  {formatPrice(s.priceCents)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
