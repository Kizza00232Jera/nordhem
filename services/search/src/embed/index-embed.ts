import { embedPassages } from "./embed.ts";

/** The text fields an embeddable document carries (products and shop docs). */
export interface EmbeddableDocument {
  name: string;
  product_class: string | null;
  description: string | null;
}

/**
 * The text we embed for a product. Title-heavy and name-first, joined into one
 * passage: product docs are short, so the name carries most of the meaning and
 * the class and description sharpen it. Nulls are dropped.
 */
export function passageText(d: EmbeddableDocument): string {
  return [d.name, d.product_class, d.description]
    .filter((s): s is string => Boolean(s))
    .join(". ");
}

// e5-small is small, but 43k passages is still a long batch (D13). Embedding in
// chunks keeps memory flat and lets a progress callback report along the way.
const DEFAULT_BATCH = 128;

/**
 * Attach an `embedding` vector to every document, batched through the local
 * model. Pure plumbing around embedPassages; the slow model call is the only
 * cost. onProgress reports after each batch so the indexing CLI can show life.
 */
export async function attachEmbeddings<T extends EmbeddableDocument>(
  docs: T[],
  opts: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<(T & { embedding: number[] })[]> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH;
  const out: (T & { embedding: number[] })[] = [];
  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const vectors = await embedPassages(chunk.map(passageText));
    chunk.forEach((doc, j) => {
      const embedding = vectors[j];
      if (!embedding) throw new Error("attachEmbeddings: model returned no vector");
      out.push({ ...doc, embedding });
    });
    opts.onProgress?.(Math.min(i + batchSize, docs.length), docs.length);
  }
  return out;
}
