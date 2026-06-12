import type { Client } from "@elastic/elasticsearch";
import type { AutocompleteResponse, AutocompleteSuggestion } from "@nordhem/shared";
import type { ProductDocument, ShopDocument } from "../es/indexer.ts";
import { buildAutocompleteBody } from "./query.ts";

const DEFAULT_SIZE = 8;

type AnyProductDocument = ProductDocument & Partial<ShopDocument>;

export async function autocompleteProducts(
  es: Client,
  index: string,
  query: string,
  size = DEFAULT_SIZE,
): Promise<AutocompleteResponse> {
  const res = await es.search<AnyProductDocument>({
    index,
    ...buildAutocompleteBody(query, size),
  });

  return {
    query,
    tookMs: res.took,
    suggestions: res.hits.hits.map((hit): AutocompleteSuggestion => {
      const source = hit._source;
      return {
        id: hit._id ?? "",
        name: source?.name ?? "",
        ...(source?.slug !== undefined && {
          slug: source.slug,
          priceCents: source.price_cents,
          imageThumbUrl: source.image_thumb_url ?? null,
        }),
      };
    }),
  };
}
