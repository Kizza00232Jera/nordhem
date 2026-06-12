import { SearchResponseSchema, type SearchHit, type SearchResponse } from "@nordhem/shared";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { formatPrice } from "../../lib/format";
import { splitMarked } from "../../lib/highlight";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";

export const metadata: Metadata = { title: "Search" };

async function search(query: string): Promise<SearchResponse> {
  const res = await fetch(
    `${SEARCH_API_URL}/search?q=${encodeURIComponent(query)}&scope=shop`,
  );
  if (!res.ok) throw new Error(`Search service responded ${res.status}`);
  return SearchResponseSchema.parse(await res.json());
}

/**
 * Renders engine-highlighted text by splitting on the <mark> tags —
 * never via innerHTML (the engine does not escape the source text).
 */
function Marked({ text }: { text: string }) {
  return splitMarked(text).map((seg, i) =>
    seg.marked ? (
      <mark
        key={i}
        className="bg-transparent font-semibold text-inherit underline decoration-amber decoration-2 underline-offset-[3px]"
      >
        {seg.text}
      </mark>
    ) : (
      <Fragment key={i}>{seg.text}</Fragment>
    ),
  );
}

function HitCard({ hit }: { hit: SearchHit }) {
  return (
    <Link
      href={`/product/${hit.slug}`}
      className="group block overflow-hidden rounded-md bg-card shadow-lift transition-shadow duration-200 hover:shadow-float"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        {hit.imageThumbUrl ? (
          <Image
            src={hit.imageThumbUrl}
            alt={hit.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-muted">
            photo pending
          </div>
        )}
      </div>
      <div className="px-4 pb-4 pt-3">
        <h2 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-snug">
          {hit.highlightName ? <Marked text={hit.highlightName} /> : hit.name}
        </h2>
        {hit.highlightDescription && (
          <p className="mt-1 line-clamp-1 text-[13px] text-ink-muted">
            <Marked text={hit.highlightDescription} />
          </p>
        )}
        {hit.priceCents !== undefined && (
          <p className="tnum mt-1.5 text-[15px] font-semibold">
            {formatPrice(hit.priceCents)}
          </p>
        )}
      </div>
    </Link>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  let results: SearchResponse | null = null;
  let unavailable = false;
  if (query) {
    try {
      results = await search(query);
    } catch {
      // The proper circuit breaker + Postgres fallback is step 10;
      // until then the page degrades honestly.
      unavailable = true;
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-light">
        {query ? <>Results for “{query}”</> : "Search"}
      </h1>

      {!query && (
        <p className="mt-4 text-[15px] text-ink-muted">
          Type something in the search bar above — try “velvet armchair” or
          “scandinavian oak bed”.
        </p>
      )}

      {unavailable && (
        <div className="mt-8 max-w-2xl rounded-md bg-linen px-5 py-4 text-[15px]">
          Search is offline right now (the engine runs on a real machine that
          is sometimes asleep). Browse the{" "}
          <Link href="/" className="text-pine underline">
            categories
          </Link>{" "}
          instead.
        </div>
      )}

      {results && (
        <section className="mt-6" aria-live="polite">
          <p className="text-[13px] text-ink-muted">
            {results.total.toLocaleString("en-US")} products · {results.tookMs}{" "}
            ms · {results.mode} mode
          </p>
          {results.suggestion && (
            <p className="mt-3 text-[15px]">
              Did you mean{" "}
              <Link
                href={`/search?q=${encodeURIComponent(results.suggestion)}`}
                className="font-medium text-pine underline"
              >
                {results.suggestion}
              </Link>
              ?
            </p>
          )}
          <ul className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {results.hits.map((hit) => (
              <li key={hit.id}>
                <HitCard hit={hit} />
              </li>
            ))}
          </ul>
          {results.total === 0 && (
            <div className="mt-8 max-w-2xl">
              <p className="text-[15px] text-ink-muted">
                Nothing found for “{results.query}”. Try fewer or different
                words, or browse the{" "}
                <Link href="/" className="text-pine underline">
                  categories
                </Link>
                .
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
