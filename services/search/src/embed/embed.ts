import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

/**
 * Local text embeddings via Transformers.js (D13): multilingual-e5-small, run
 * in-process through ONNX, no embedding API in the hot path. The model maps a
 * short text to a 384-number vector; closeness between vectors means closeness
 * in meaning, which is what powers kNN and hybrid search.
 *
 * e5 was trained with two required prefixes: a search string must be prefixed
 * "query: " and an indexed document "passage: ". We bake those in here so a
 * caller can never forget one (a mismatched prefix quietly wrecks relevance).
 * Vectors come out mean-pooled and L2-normalized, so cosine similarity is just
 * their dot product.
 */
export const EMBED_DIM = 384;

const MODEL_ID = "Xenova/multilingual-e5-small";

// The pipeline is heavy to construct (loads the weights once); memoize the
// promise so every caller in the process shares a single warm model.
let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline("feature-extraction", MODEL_ID);
  }
  return pipelinePromise;
}

async function embed(prefixed: string[]): Promise<number[][]> {
  const extractor = await getPipeline();
  const output = await extractor(prefixed, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}

/** Embed a search string (gets the e5 "query: " prefix). */
export async function embedQuery(text: string): Promise<number[]> {
  const vectors = await embed([`query: ${text}`]);
  const vec = vectors[0];
  if (!vec) throw new Error("embedQuery: model returned no vector");
  return vec;
}

/** Embed one document's text (gets the e5 "passage: " prefix). */
export async function embedPassage(text: string): Promise<number[]> {
  const vectors = await embed([`passage: ${text}`]);
  const vec = vectors[0];
  if (!vec) throw new Error("embedPassage: model returned no vector");
  return vec;
}

/** Embed many documents at once (batched), for the indexing pipeline. */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return embed(texts.map((t) => `passage: ${t}`));
}
