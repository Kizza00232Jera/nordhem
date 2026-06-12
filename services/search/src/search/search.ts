import type { Client } from "@elastic/elasticsearch";
import type { SearchHit, SearchResponse } from "@nordhem/shared";
import type { ProductDocument, ShopDocument } from "../es/indexer.ts";
import { buildSearchBody } from "./query.ts";

const DEFAULT_SIZE = 20;

type AnyProductDocument = ProductDocument & Partial<ShopDocument>;

export async function searchProducts(
  es: Client,
  index: string,
  query: string,
  size = DEFAULT_SIZE,
): Promise<SearchResponse> {
  const res = await es.search<AnyProductDocument>({
    index,
    ...buildSearchBody(query, size),
  });

  const total =
    typeof res.hits.total === "number"
      ? res.hits.total
      : (res.hits.total?.value ?? 0);

  // The client types options as T | T[]; ES returns an array for phrase
  // suggesters. The text is present only when the suggester beat the query.
  const dymEntry = res.suggest?.["did_you_mean"]?.[0];
  const dymOptions = dymEntry
    ? [dymEntry.options].flat()
    : [];
  const suggestion = dymOptions[0]?.text;

  return {
    query,
    mode: "full",
    ...(suggestion !== undefined && { suggestion }),
    total,
    tookMs: res.took,
    hits: res.hits.hits.map((hit): SearchHit => {
      const source = hit._source;
      return {
        id: hit._id ?? "",
        name: source?.name ?? "",
        productClass: source?.product_class ?? null,
        description: source?.description ?? null,
        score: hit._score ?? 0,
        ...(hit.highlight?.["name"]?.[0] !== undefined && {
          highlightName: hit.highlight["name"][0],
        }),
        ...(hit.highlight?.["description"]?.[0] !== undefined && {
          highlightDescription: hit.highlight["description"][0],
        }),
        // Card fields exist only in shop-index documents.
        ...(source?.slug !== undefined && {
          slug: source.slug,
          category: source.category,
          priceCents: source.price_cents,
          imageThumbUrl: source.image_thumb_url ?? null,
        }),
      };
    }),
  };
}
