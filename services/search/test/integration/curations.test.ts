import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexProducts } from "../../src/es/indexer.ts";
import { searchProducts } from "../../src/search/search.ts";
import type { RawProduct } from "../../src/wands/parse.ts";

const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:9.3.1";
const INDEX = "products-curations-test";

function makeProduct(o: Partial<RawProduct> & Pick<RawProduct, "productId" | "name">): RawProduct {
  return {
    productClass: null, categoryHierarchy: null, description: null, features: null,
    ratingCount: null, averageRating: null, reviewCount: null, ...o,
  };
}

const FIXTURES: RawProduct[] = [
  makeProduct({ productId: 1, name: "alpha sofa" }),
  makeProduct({ productId: 2, name: "beta sofa" }),
  makeProduct({ productId: 3, name: "gamma sofa" }),
  makeProduct({ productId: 4, name: "delta desk lamp" }),
];

describe("curations (pin/hide) in search", () => {
  let es: ReturnType<typeof createEsClient>;
  let container: StartedElasticsearchContainer;

  beforeAll(async () => {
    container = await new ElasticsearchContainer(ES_IMAGE)
      .withEnvironment({ "xpack.security.enabled": "false" })
      .withStartupTimeout(180_000)
      .start();
    es = createEsClient(container.getHttpUrl());
    await indexProducts(es, INDEX, FIXTURES);
  }, 300_000);

  afterAll(async () => {
    await es?.indices.delete({ index: INDEX }).catch(() => {});
    await container?.stop();
  });

  it("pins a product to the top and hides another", async () => {
    const res = await searchProducts(es, INDEX, "sofa", {
      curation: { pinned: [3], hidden: [1] },
      size: 10,
    });
    expect(res.hits[0]?.id).toBe("3"); // gamma pinned to the top
    expect(res.hits.map((h) => h.id)).not.toContain("1"); // alpha hidden
  });

  it("pins a product the query did not even match, hydrating it", async () => {
    const res = await searchProducts(es, INDEX, "sofa", {
      curation: { pinned: [4], hidden: [] },
      size: 10,
    });
    expect(res.hits[0]?.id).toBe("4"); // the lamp, pinned above the sofas
    expect(res.hits[0]?.name).toBe("delta desk lamp"); // hydrated, not a bare id
  });
});
