import { AutocompleteResponseSchema } from "@nordhem/shared";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";

/**
 * Same-origin proxy for the search service's /autocomplete — the browser
 * never talks to the PC tunnel directly. Shop scope only: the combobox
 * suggests buyable products.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return Response.json(
      { error: "query parameter q is required" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${SEARCH_API_URL}/autocomplete?q=${encodeURIComponent(q)}&scope=shop`,
      // Mirrors the planned circuit-breaker budget (D12): a sleeping PC
      // must not hold the combobox hostage.
      { signal: AbortSignal.timeout(800) },
    );
    if (!res.ok) throw new Error(`search service responded ${res.status}`);
    return Response.json(AutocompleteResponseSchema.parse(await res.json()));
  } catch {
    // Lite mode: autocomplete degrades to silence, /search stays honest.
    return Response.json({ query: q, tookMs: 0, suggestions: [] });
  }
}
