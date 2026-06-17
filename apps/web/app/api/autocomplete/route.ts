import { AutocompleteResponseSchema } from "@nordhem/shared";
import { getSearchBackend } from "../../../lib/search-source";

/**
 * Same-origin proxy for the search service's /autocomplete — the browser
 * never talks to the PC tunnel directly. Shop scope only: the combobox
 * suggests buyable products. Honors the per-session connected engine (Step 12).
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
    const backend = await getSearchBackend();
    const res = await fetch(
      `${backend.url}/autocomplete?q=${encodeURIComponent(q)}&scope=shop`,
      // Mirrors the planned circuit-breaker budget (D12): a sleeping PC
      // must not hold the combobox hostage.
      {
        signal: AbortSignal.timeout(800),
        ...(backend.token ? { headers: { authorization: `Bearer ${backend.token}` } } : {}),
      },
    );
    if (!res.ok) throw new Error(`search service responded ${res.status}`);
    return Response.json(AutocompleteResponseSchema.parse(await res.json()));
  } catch {
    // Lite mode: autocomplete degrades to silence, /search stays honest.
    return Response.json({ query: q, tookMs: 0, suggestions: [] });
  }
}
