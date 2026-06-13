"use server";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";

export interface EvalMetrics {
  ndcg: number;
  mrr: number;
  recall: number;
  queryCount: number;
}

export type EvalOutcome = EvalMetrics | { error: string };

/**
 * Score a ranking config in the relevance lab by forwarding it to the search
 * service's /eval endpoint (which owns Elasticsearch and the judged set). Runs
 * on a train-split sample for a snappy tuning loop. The config is untrusted on
 * the way in and re-clamped server-side, so we pass it through as-is.
 */
export async function evalRankingAction(
  config: unknown,
  size = 120,
): Promise<EvalOutcome> {
  try {
    const res = await fetch(`${SEARCH_API_URL}/eval`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config, split: "train", size }),
    });
    if (!res.ok) return { error: `eval failed (HTTP ${res.status})` };
    const d = (await res.json()) as EvalMetrics;
    return { ndcg: d.ndcg, mrr: d.mrr, recall: d.recall, queryCount: d.queryCount };
  } catch {
    return { error: "Could not reach the search service. Is it running (pnpm -F @nordhem/search dev)?" };
  }
}
