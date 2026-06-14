import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexProducts } from "../../src/es/indexer.ts";
import { embedQuery } from "../../src/embed/embed.ts";
import { knnProductIds } from "../../src/search/semantic.ts";
import type { RawProduct } from "../../src/wands/parse.ts";

const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:9.3.1";
const INDEX = "products-semantic-test";

function makeProduct(o: Partial<RawProduct> & Pick<RawProduct, "productId" | "name">): RawProduct {
  return {
    productClass: null, categoryHierarchy: null, description: null, features: null,
    ratingCount: null, averageRating: null, reviewCount: null, ...o,
  };
}

// None of these names contain the word "sofa"; lexical BM25 for "sofa" would
// miss the couch entirely. Semantic search should still rank it first.
const FIXTURES: RawProduct[] = [
  makeProduct({ productId: 1, name: "two-seater couch", productClass: "Sofas", description: "comfortable upholstered loveseat for the living room" }),
  makeProduct({ productId: 2, name: "stainless steel cookware set", productClass: "Kitchen", description: "non-stick pots and pans" }),
  makeProduct({ productId: 3, name: "solid oak coffee table", productClass: "Tables", description: "rectangular wooden table" }),
];

describe("semantic retrieval (dense_vector + kNN)", () => {
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

  it("retrieves the semantically closest product for a word it never contains", async () => {
    const vector = await embedQuery("sofa");
    const ids = await knnProductIds(es, INDEX, vector, { k: 3, numCandidates: 10 });
    expect(ids[0]).toBe(1); // the couch, despite no lexical "sofa" match
  });

  it("ranks an unrelated query's best match away from the couch", async () => {
    const vector = await embedQuery("frying pan");
    const ids = await knnProductIds(es, INDEX, vector, { k: 3, numCandidates: 10 });
    expect(ids[0]).toBe(2); // the cookware set
  });
});
