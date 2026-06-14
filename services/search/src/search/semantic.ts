import type { Client } from "@elastic/elasticsearch";

export interface KnnOptions {
  /** How many nearest neighbours to return. */
  k?: number;
  /** How many candidates each shard inspects (the speed/recall dial). */
  numCandidates?: number;
}

/**
 * Semantic retrieval: the product ids nearest to a query vector, by approximate
 * kNN over the HNSW graph on the `embedding` field. num_candidates is the
 * recall/speed dial: ES gathers that many candidates per shard, then keeps the
 * top k. _source: false because we only need the ranked ids (the harness and
 * the hybrid fuser join back to full documents later).
 */
export async function knnProductIds(
  es: Client,
  index: string,
  vector: number[],
  opts: KnnOptions = {},
): Promise<number[]> {
  const k = opts.k ?? 100;
  const numCandidates = opts.numCandidates ?? Math.max(k, 100);
  const res = await es.search<unknown>({
    index,
    knn: { field: "embedding", query_vector: vector, k, num_candidates: numCandidates },
    _source: false,
    size: k,
  });
  return res.hits.hits
    .map((hit) => Number(hit._id))
    .filter((id) => Number.isFinite(id));
}
