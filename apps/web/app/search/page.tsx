import { SearchResponseSchema, type SearchResponse } from "@nordhem/shared";
import type { Metadata } from "next";
import Link from "next/link";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";

export const metadata: Metadata = { title: "Search" };

async function search(query: string): Promise<SearchResponse> {
  const res = await fetch(
    `${SEARCH_API_URL}/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`Search service responded ${res.status}`);
  return SearchResponseSchema.parse(await res.json());
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
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-light">Search</h1>

      {!query && (
        <p className="mt-4 text-[15px] text-ink-muted">
          Type something in the search bar above — try “velvet armchair” or
          “scandinavian oak bed”.
        </p>
      )}

      {unavailable && (
        <div className="mt-8 rounded-md bg-linen px-5 py-4 text-[15px]">
          Search is offline right now (the engine runs on a real machine that
          is sometimes asleep). Browse the{" "}
          <Link href="/" className="text-pine underline">
            categories
          </Link>{" "}
          instead.
        </div>
      )}

      {results && (
        <section className="mt-8" aria-live="polite">
          <p className="text-[13px] text-ink-muted">
            {results.total.toLocaleString("en-US")} results for “{results.query}”
            · {results.tookMs} ms · {results.mode} mode
          </p>
          <ol className="mt-5 space-y-4">
            {results.hits.map((hit) => (
              <li
                key={hit.id}
                className="rounded-md bg-card p-5 shadow-lift"
              >
                <h2 className="text-[16px] font-semibold leading-snug">
                  {hit.name}
                </h2>
                {hit.productClass && (
                  <p className="mt-0.5 text-[12px] uppercase tracking-wide text-ink-muted">
                    {hit.productClass}
                  </p>
                )}
                {hit.description && (
                  <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink-muted">
                    {hit.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {results.total === 0 && (
            <p className="mt-6 text-[15px] text-ink-muted">
              Nothing found for “{results.query}”. Try fewer words, or browse
              the categories above.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
