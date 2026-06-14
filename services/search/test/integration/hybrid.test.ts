import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexProducts } from "../../src/es/indexer.ts";
import { hybridProductIds, lexicalProductIds } from "../../src/search/semantic.ts";
import type { RawProduct } from "../../src/wands/parse.ts";

const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:9.3.1";
const INDEX = "products-hybrid-test";

function makeProduct(o: Partial<RawProduct> & Pick<RawProduct, "productId" | "name">): RawProduct {
  return {
    productClass: null, categoryHierarchy: null, description: null, features: null,
    ratingCount: null, averageRating: null, reviewCount: null, ...o,
  };
}

// "bed" and "mattress" are semantically close but share no token, stem, or
// synonym rule, so lexical "bed" cannot reach the mattress; only meaning can.
const FIXTURES: RawProduct[] = [
  // semantically a bed, but the word "bed" never appears -> lexical misses it
  makeProduct({ productId: 1, name: "queen size mattress", productClass: "Mattresses", description: "memory foam mattress for a good night" }),
  // literally a bed -> strong in BOTH lexical and semantic
  makeProduct({ productId: 10, name: "wooden bed frame", productClass: "Beds", description: "solid oak bed frame" }),
  makeProduct({ productId: 2, name: "stainless steel cookware set", productClass: "Kitchen", description: "non-stick pots and pans" }),
];

describe("hybrid retrieval (RRF over BM25 + kNN)", () => {
  let es: ReturnType<typeof createEsClient>;
  let container: StartedElasticsearchContainer;

  beforeAll(async () => {
    container = await new ElasticsearchContainer(ES_IMAGE)
      .withEnvironment({ "xpack.security.enabled": "false" })
      .withStartupTimeout(180_000)
      .start();
    es = createEsClient(container.getHttpUrl());
    await indexProducts(es, INDEX, FIXTURES, { embed: true });
  }, 300_000);

  afterAll(async () => {
    await es?.indices.delete({ index: INDEX }).catch(() => {});
    await container?.stop();
  });

  it("lexical search alone misses the wordless mattress", async () => {
    const lex = await lexicalProductIds(es, INDEX, "bed", 10);
    expect(lex).toContain(10); // the literal "wooden bed frame"
    expect(lex).not.toContain(1); // the mattress has no "bed" token, stem, or synonym
  });

  it("hybrid keeps the strong-in-both result on top and rescues the semantic-only one", async () => {
    const ids = await hybridProductIds(es, INDEX, "bed", { k: 3, numCandidates: 10 });
    expect(ids[0]).toBe(10); // strong in both lexical and semantic
    expect(ids).toContain(1); // fusion surfaces the mattress that lexical alone dropped
  });
});
