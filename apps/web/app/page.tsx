import { SearchResponseSchema, type SearchResponse } from "@nordhem/shared";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";

// The contract is enforced at the trust boundary: whatever the search
// service returns must parse, or this page fails loudly instead of
// rendering half-shaped data.
async function search(query: string): Promise<SearchResponse> {
  const res = await fetch(
    `${SEARCH_API_URL}/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) {
    throw new Error(`Search service responded ${res.status}`);
  }
  return SearchResponseSchema.parse(await res.json());
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();
  const results = query ? await search(query) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">NORDHEM</h1>
      <p className="mt-1 text-sm text-neutral-500">sleep, live, store</p>

      <form action="/" className="mt-8 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search 42,994 products…"
          aria-label="Search products"
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          Search
        </button>
      </form>

      {results && (
        <section className="mt-8" aria-live="polite">
          <p className="text-sm text-neutral-500">
            {results.total.toLocaleString("en-US")} results for
            “{results.query}” · {results.tookMs} ms · {results.mode} mode
          </p>
          <ol className="mt-4 space-y-4">
            {results.hits.map((hit) => (
              <li key={hit.id} className="rounded border border-neutral-200 p-4">
                <h2 className="font-medium">{hit.name}</h2>
                {hit.productClass && (
                  <p className="text-xs uppercase tracking-wide text-neutral-400">
                    {hit.productClass}
                  </p>
                )}
                {hit.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                    {hit.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-neutral-400">
                  score {hit.score.toFixed(2)}
                </p>
              </li>
            ))}
          </ol>
          {results.total === 0 && (
            <p className="mt-4 text-neutral-600">
              Nothing found for “{results.query}”.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
