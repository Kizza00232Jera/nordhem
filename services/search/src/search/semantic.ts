import type { Client } from "@elastic/elasticsearch";
import { embedQuery } from "../embed/embed.ts";
import { buildSearchBody } from "./query.ts";
import { rrfFuse } from "./rrf.ts";

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

/**
 * Lexical retrieval: the ranked product ids from the BM25 query (the same
 * production query buildSearchBody produces), for fusing with kNN.
 */
export async function lexicalProductIds(
  es: Client,
  index: string,
  queryText: string,
  size = 100,
): Promise<number[]> {
  const res = await es.search<unknown>({ index, ...buildSearchBody(queryText, size, {}) });
  return res.hits.hits
    .map((hit) => Number(hit._id))
    .filter((id) => Number.isFinite(id));
}

export interface HybridOptions {
  /** Final number of fused results to return. */
  k?: number;
  /** kNN candidate depth (recall/speed dial). */
  numCandidates?: number;
  /** RRF rank constant. */
  rrfK?: number;
}

/**
 * Hybrid retrieval: run lexical (BM25) and semantic (kNN) in parallel, then
 * fuse their rankings with RRF. The query is embedded once in-process. This is
 * the path that catches both the keyword match BM25 is good at and the meaning
 * match kNN is good at, without either score scale leaking into the other.
 */
export async function hybridProductIds(
  es: Client,
  index: string,
  queryText: string,
  opts: HybridOptions = {},
): Promise<number[]> {
  const k = opts.k ?? 100;
  const vector = await embedQuery(queryText);
  const [lexical, semantic] = await Promise.all([
    lexicalProductIds(es, index, queryText, k),
    knnProductIds(es, index, vector, { k, numCandidates: opts.numCandidates }),
  ]);
  return rrfFuse([lexical, semantic], { k: opts.rrfK }).slice(0, k);
}
