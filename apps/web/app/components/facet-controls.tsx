"use client";

import type { FacetBucket, PriceBucket, SearchFacets } from "@nordhem/shared";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { setSingleParam, toggleListParam } from "../../lib/facet-url";

const PRICE_LABELS: Record<string, string> = {
  "under-500": "Under 500 kr",
  "500-1000": "500 – 1.000 kr",
  "1000-2000": "1.000 – 2.000 kr",
  "2000-plus": "2.000 kr +",
};

const FACET_TITLES: Record<string, string> = {
  category: "Category",
  color: "Colour",
  material: "Material",
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Facet sidebar — the JYSK pattern, NORDHEM-styled: a universal spine
 * (category, colour, material, price) with live counts from Elasticsearch
 * aggregations, multi-select within a facet, applied-filter chips, and
 * clear-all. All state is URL-synced via the pure helpers in lib/facet-url.
 */
export function FacetSidebar({ facets }: { facets: SearchFacets }) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.toString();
  const go = (qs: string) => router.push(qs ? `/search?${qs}` : "/search");

  const selectedPrice = sp.get("price");
  const chips: { label: string; href: string }[] = [];
  for (const key of ["category", "color", "material"] as const) {
    for (const value of sp.getAll(key)) {
      chips.push({ label: titleCase(value), href: toggleListParam(current, key, value) });
    }
  }
  if (selectedPrice && PRICE_LABELS[selectedPrice]) {
    chips.push({ label: PRICE_LABELS[selectedPrice], href: setSingleParam(current, "price", null) });
  }

  function clearAll() {
    const kept = new URLSearchParams();
    const q = sp.get("q");
    if (q) kept.set("q", q);
    const sort = sp.get("sort");
    if (sort) kept.set("sort", sort);
    go(kept.toString());
  }

  return (
    <aside aria-label="Filters" className="text-[14px]">
      {chips.length > 0 && (
        <div className="mb-6 border-b border-line pb-5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Applied
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[13px] text-pine underline underline-offset-2 hover:text-pine-deep"
            >
              Clear all
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.label}>
                <button
                  type="button"
                  onClick={() => go(chip.href)}
                  className="inline-flex items-center gap-1.5 rounded-xs border border-line bg-card px-2.5 py-1 text-[13px] hover:border-pine"
                >
                  {chip.label}
                  <X aria-hidden className="size-3.5 text-ink-muted" strokeWidth={1.75} />
                  <span className="sr-only">Remove filter</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(["category", "color", "material"] as const).map((key) => (
        <TermsFacet
          key={key}
          title={FACET_TITLES[key]}
          buckets={key === "category" ? facets.categories : key === "color" ? facets.colors : facets.materials}
          selected={sp.getAll(key)}
          onToggle={(value) => go(toggleListParam(current, key, value))}
        />
      ))}

      <PriceFacet
        buckets={facets.prices}
        selected={selectedPrice}
        onSelect={(bandKey) =>
          go(setSingleParam(current, "price", bandKey === selectedPrice ? null : bandKey))
        }
      />
    </aside>
  );
}

function TermsFacet({
  title,
  buckets,
  selected,
  onToggle,
}: {
  title: string;
  buckets: FacetBucket[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (buckets.length === 0) return null;
  return (
    <fieldset className="mb-6 border-b border-line pb-5">
      <legend className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </legend>
      <ul className="space-y-1.5">
        {buckets.map((b) => (
          <li key={b.value}>
            <label className="flex cursor-pointer items-center gap-2.5 py-0.5">
              <input
                type="checkbox"
                checked={selected.includes(b.value)}
                onChange={() => onToggle(b.value)}
                className="size-4 accent-pine"
              />
              <span className="flex-1 capitalize">{b.value}</span>
              <span className="tnum text-[13px] text-ink-muted">{b.count}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function PriceFacet({
  buckets,
  selected,
  onSelect,
}: {
  buckets: PriceBucket[];
  selected: string | null;
  onSelect: (bandKey: string) => void;
}) {
  if (buckets.length === 0) return null;
  return (
    <fieldset className="mb-6">
      <legend className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
        Price
      </legend>
      <ul className="space-y-1.5">
        {buckets.map((b) => (
          <li key={b.key}>
            <label className="flex cursor-pointer items-center gap-2.5 py-0.5">
              <input
                type="radio"
                name="price"
                checked={selected === b.key}
                onChange={() => onSelect(b.key)}
                className="size-4 accent-pine"
              />
              <span className="flex-1">{PRICE_LABELS[b.key] ?? b.key}</span>
              <span className="tnum text-[13px] text-ink-muted">{b.count}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

const SORT_LABELS: { value: string; label: string }[] = [
  { value: "relevance", label: "Most relevant" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export function SortSelect() {
  const router = useRouter();
  const sp = useSearchParams();
  const value = sp.get("sort") ?? "relevance";
  return (
    <label className="flex items-center gap-2 text-[14px]">
      <span className="text-ink-muted">Sort</span>
      <select
        value={value}
        onChange={(e) =>
          router.push(
            `/search?${setSingleParam(sp.toString(), "sort", e.target.value === "relevance" ? null : e.target.value)}`,
          )
        }
        className="h-9 rounded-xs border border-line bg-card px-2.5 text-[14px]"
      >
        {SORT_LABELS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
