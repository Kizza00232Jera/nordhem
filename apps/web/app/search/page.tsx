import { SearchResponseSchema, type SearchHit, type SearchResponse } from "@nordhem/shared";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { FacetSidebar, SortSelect } from "../components/facet-controls";
import { TrackSearch } from "../components/track-search";
import { TrackedLink } from "../components/tracked-link";
import { goToPage } from "../../lib/facet-url";
import { formatPrice } from "../../lib/format";
import { splitMarked } from "../../lib/highlight";
import { clickPosition } from "../../lib/track";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 24;

export const metadata: Metadata = { title: "Search" };

type RawParams = Record<string, string | string[] | undefined>;
const LIST_KEYS = ["category", "color", "material"] as const;
const SINGLE_KEYS = ["price", "sort", "page", "mode"] as const;

// The storefront retrieval toggle (Step 8). Labels are shopper-friendly; the
// hint names the engineering underneath for anyone curious.
const MODES = [
  { value: "lexical", label: "Keyword", hint: "classic word match (BM25)" },
  { value: "semantic", label: "Meaning", hint: "vector similarity (e5 + kNN)" },
  { value: "hybrid", label: "Hybrid", hint: "keyword and meaning fused (RRF)" },
] as const;

// Keyword is the default: it is the mode that also works in lite mode (when the
// PC search service is asleep and the shop falls back to Postgres full-text),
// so the default behaves the same whether or not embeddings are reachable. The
// Meaning/Hybrid toggle lights up when the full search service is up.
const DEFAULT_MODE = "lexical";

function modeOf(params: RawParams): string {
  const m = params.mode;
  return typeof m === "string" && MODES.some((x) => x.value === m) ? m : DEFAULT_MODE;
}

/** The public querystring the browser shows — what the facet links operate on. */
function publicQuery(query: string, params: RawParams): string {
  const usp = new URLSearchParams();
  usp.set("q", query);
  for (const key of LIST_KEYS) {
    const v = params[key];
    for (const x of Array.isArray(v) ? v : v ? [v] : []) usp.append(key, x);
  }
  for (const key of SINGLE_KEYS) {
    const v = params[key];
    if (typeof v === "string" && v) usp.set(key, v);
  }
  return usp.toString();
}

async function search(query: string, params: RawParams): Promise<SearchResponse> {
  const usp = new URLSearchParams(publicQuery(query, params));
  usp.set("scope", "shop");
  usp.set("size", String(PAGE_SIZE));
  usp.set("mode", modeOf(params)); // explicit, so a no-mode URL still gets the hybrid default
  const res = await fetch(`${SEARCH_API_URL}/search?${usp.toString()}`);
  if (!res.ok) throw new Error(`Search service responded ${res.status}`);
  return SearchResponseSchema.parse(await res.json());
}

function Pagination({
  total,
  page,
  currentQs,
}: {
  total: number;
  page: number;
  currentQs: string;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const linkClass =
    "rounded-xs border border-line bg-card px-3.5 py-2 text-[14px] hover:border-pine";
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4">
      {page > 1 ? (
        <Link href={`/search?${goToPage(currentQs, page - 1)}`} className={linkClass} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={`${linkClass} cursor-default text-ink-muted opacity-50`}>Previous</span>
      )}
      <span className="text-[14px] text-ink-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`/search?${goToPage(currentQs, page + 1)}`} className={linkClass} rel="next">
          Next
        </Link>
      ) : (
        <span className={`${linkClass} cursor-default text-ink-muted opacity-50`}>Next</span>
      )}
    </nav>
  );
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

/** Segmented control switching the retrieval mode, preserving q and facets. */
function ModeToggle({ query, params }: { query: string; params: RawParams }) {
  const current = modeOf(params);
  return (
    <div className="mt-5 inline-flex rounded-md border border-line bg-card p-1 text-[13px]">
      {MODES.map((m) => {
        const usp = new URLSearchParams(publicQuery(query, params));
        usp.set("mode", m.value);
        usp.delete("page"); // a new ranking starts at page 1
        const active = m.value === current;
        return (
          <Link
            key={m.value}
            href={`/search?${usp.toString()}`}
            title={m.hint}
            aria-current={active ? "true" : undefined}
            className={
              "rounded-xs px-3.5 py-1.5 transition-colors " +
              (active ? "bg-pine font-semibold text-white" : "text-ink-muted hover:text-ink")
            }
          >
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}

function HitCard({ hit, query, position }: { hit: SearchHit; query: string; position: number }) {
  return (
    <TrackedLink
      href={`/product/${hit.slug}`}
      query={query}
      productId={Number(hit.id)}
      position={position}
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
    </TrackedLink>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const query = q?.trim();
  const page = Math.max(1, Number(params.page) || 1);

  let results: SearchResponse | null = null;
  let unavailable = false;
  if (query) {
    try {
      results = await search(query, params);
    } catch {
      // The proper circuit breaker + Postgres fallback is step 10;
      // until then the page degrades honestly.
      unavailable = true;
    }
  }
  const currentQs = query ? publicQuery(query, params) : "";

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

      {query && <ModeToggle query={query} params={params} />}

      {results && (
        <TrackSearch
          query={results.query}
          mode={modeOf(params) as "lexical" | "semantic" | "hybrid"}
          resultCount={results.total}
          latencyMs={Math.round(results.tookMs)}
        />
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

      {results && results.suggestion && (
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

      {results && results.total === 0 && (
        <div className="mt-8 max-w-2xl">
          <p className="text-[15px] text-ink-muted">
            Nothing found for “{results.query}”. Try fewer or different words, or
            browse the{" "}
            <Link href="/" className="text-pine underline">
              categories
            </Link>
            .
          </p>
        </div>
      )}

      {results && results.total > 0 && (
        <div className={`mt-8 grid grid-cols-1 gap-x-10 gap-y-6 ${results.facets ? "lg:grid-cols-[14rem_1fr]" : ""}`}>
          {results.facets && (
            <div className="lg:sticky lg:top-24 lg:self-start">
              <FacetSidebar facets={results.facets} />
            </div>
          )}
          <section aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <p className="text-[13px] text-ink-muted">
                {results.total.toLocaleString("en-US")} products · {results.tookMs} ms ·{" "}
                {results.mode} mode
              </p>
              <SortSelect />
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.hits.map((hit, i) => (
                <li key={hit.id}>
                  <HitCard hit={hit} query={results.query} position={clickPosition(page, i, PAGE_SIZE)} />
                </li>
              ))}
            </ul>
            <Pagination total={results.total} page={page} currentQs={currentQs} />
          </section>
        </div>
      )}
    </main>
  );
}
