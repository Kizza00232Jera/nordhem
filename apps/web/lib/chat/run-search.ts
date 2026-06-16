import { SearchResponseSchema } from "@nordhem/shared";
import { toolArgsToQueryString, type SearchToolArgs, type ToolHit } from "./tools";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";

/**
 * The search_products tool body: call OUR search service (shop scope) and map
 * hits to the compact shape the model sees. Full-mode only — the chatbot is
 * hidden in lite mode — so a direct call is fine; a failure surfaces as "no
 * results" to the model rather than breaking the turn.
 */
export async function runCatalogSearch(args: SearchToolArgs): Promise<ToolHit[]> {
  const res = await fetch(`${SEARCH_API_URL}/search?${toolArgsToQueryString(args)}`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`search service responded ${res.status}`);
  const data = SearchResponseSchema.parse(await res.json());
  return data.hits.map((h) => ({
    name: h.name,
    priceCents: h.priceCents ?? null,
    category: h.category ?? null,
    slug: h.slug ?? null,
  }));
}
