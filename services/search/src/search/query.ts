import type { estypes } from "@elastic/elasticsearch";

/**
 * The step-1 baseline query: naive multi_match (best_fields, OR operator,
 * standard analyzer, no boosts, no fuzziness, no synonyms). Deliberately
 * primitive — the relevance lab measures it before step 3 improves it.
 */
export function buildSearchBody(
  query: string,
  size: number,
): estypes.SearchRequest {
  return {
    query: {
      multi_match: {
        query,
        fields: ["name", "product_class", "description"],
      },
    },
    size,
  };
}
