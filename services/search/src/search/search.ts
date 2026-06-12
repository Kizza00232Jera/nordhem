import type { Client } from "@elastic/elasticsearch";
import type { SearchResponse } from "@nordhem/shared";
import type { ProductDocument } from "../es/indexer.ts";
import { buildSearchBody } from "./query.ts";

const DEFAULT_SIZE = 20;

export async function searchProducts(
  es: Client,
  index: string,
  query: string,
  size = DEFAULT_SIZE,
): Promise<SearchResponse> {
  const res = await es.search<ProductDocument>({
    index,
    ...buildSearchBody(query, size),
  });

  const total =
    typeof res.hits.total === "number"
      ? res.hits.total
      : (res.hits.total?.value ?? 0);

  return {
    query,
    mode: "full",
    total,
    tookMs: res.took,
    hits: res.hits.hits.map((hit) => ({
      id: hit._id ?? "",
      name: hit._source?.name ?? "",
      productClass: hit._source?.product_class ?? null,
      description: hit._source?.description ?? null,
      score: hit._score ?? 0,
    })),
  };
}
