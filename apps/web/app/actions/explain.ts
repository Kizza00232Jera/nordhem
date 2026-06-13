"use server";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";

/** Elasticsearch's recursive score-breakdown node. */
export interface ExplainNode {
  value: number;
  description: string;
  details?: ExplainNode[];
}

export type ExplainOutcome =
  | { matched: boolean; explanation: ExplainNode }
  | { error: string };

/**
 * Ask the search service why a product scored what it did for a query, using
 * the production ranking. Returns the raw Elasticsearch explanation tree.
 */
export async function explainAction(
  query: string,
  productId: string,
  scope: "all" | "shop",
): Promise<ExplainOutcome> {
  const q = query.trim();
  const id = productId.trim();
  if (!q || !id) return { error: "Enter a query and a product id." };
  try {
    const url = `${SEARCH_API_URL}/explain?q=${encodeURIComponent(q)}&id=${encodeURIComponent(id)}&scope=${scope}`;
    const res = await fetch(url);
    if (res.status === 404) return { error: "No product with that id in this index." };
    if (!res.ok) return { error: `explain failed (HTTP ${res.status})` };
    const d = (await res.json()) as { matched: boolean; explanation: ExplainNode };
    return { matched: d.matched, explanation: d.explanation };
  } catch {
    return { error: "Could not reach the search service. Is it running?" };
  }
}
