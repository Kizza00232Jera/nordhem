import { beforeAll, describe, expect, it } from "vitest";
import { EMBED_DIM, embedPassage, embedPassages, embedQuery } from "../../src/embed/embed.ts";

// Runs the real local multilingual-e5-small model (no network in the hot path,
// but the weights download once on the first run). It lives in the integration
// project for its generous timeout; it needs no container.

function l2norm(v: number[]): number {
  return Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot / (l2norm(a) * l2norm(b));
}

describe("embed (multilingual-e5-small)", () => {
  let sofaQ: number[];

  beforeAll(async () => {
    sofaQ = await embedQuery("sofa");
  }, 180_000);

  it("produces a normalized vector of the model's dimension", () => {
    expect(EMBED_DIM).toBe(384);
    expect(sofaQ).toHaveLength(EMBED_DIM);
    expect(sofaQ.every((x) => Number.isFinite(x))).toBe(true);
    expect(l2norm(sofaQ)).toBeCloseTo(1, 5); // unit length, for cosine via dot
  });

  it("is deterministic for the same input", async () => {
    const again = await embedQuery("sofa");
    expect(again).toEqual(sofaQ);
  });

  it("places a relevant passage closer than an irrelevant one (the whole point)", async () => {
    const couch = await embedPassage("a comfortable upholstered couch for the living room");
    const knife = await embedPassage("a stainless steel kitchen knife set");
    expect(cosine(sofaQ, couch)).toBeGreaterThan(cosine(sofaQ, knife));
  });

  it("batches passages into one vector each", async () => {
    const vecs = await embedPassages(["oak dining table", "wool area rug"]);
    expect(vecs).toHaveLength(2);
    expect(vecs[0]).toHaveLength(EMBED_DIM);
    expect(vecs[1]).toHaveLength(EMBED_DIM);
  });
});
