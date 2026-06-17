import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexShopDocuments, type ShopDocument } from "../../src/es/indexer.ts";
import { searchProducts } from "../../src/search/search.ts";

// Step 11a wiring against real Elasticsearch: a learned affinity boost rides
// into the BM25 query as a function_score weight and reorders the page. We pick
// a query where two products tie/lose on text, then prove a boost on the
// normally-lower one floats it to the top — the click-feedback loop made real,
// scored by the engine (never mocked).
const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:9.3.1";
const SHOP_INDEX = "products-shop-affinity-test";

const FIXTURES: ShopDocument[] = [
  {
    product_id: 10,
    name: "office chair",
    product_class: "Office Chairs",
    description: "an office chair",
    slug: "office-chair-10",
    category: "chairs",
    price_cents: 19999,
    image_thumb_url: null,
    color: "black",
    material: "mesh",
  },
  {
    product_id: 20,
    name: "office chair deluxe edition",
    product_class: "Office Chairs",
    description: "a longer named office chair so its BM25 differs",
    slug: "office-chair-deluxe-20",
    category: "chairs",
    price_cents: 29999,
    image_thumb_url: null,
    color: "grey",
    material: "leather",
  },
];

let container: StartedElasticsearchContainer;
let es: ReturnType<typeof createEsClient>;

beforeAll(async () => {
  container = await new ElasticsearchContainer(ES_IMAGE)
    .withEnvironment({
      "xpack.security.enabled": "false",
      "discovery.type": "single-node",
      ES_JAVA_OPTS: "-Xms512m -Xmx512m",
    })
    .start();
  es = createEsClient(container.getHttpUrl());
  await indexShopDocuments(es, SHOP_INDEX, FIXTURES);
});

afterAll(async () => {
  await container?.stop();
});

describe("affinity boost reorders BM25 results", () => {
  it("a strong boost lifts a product above the higher-BM25 default winner", async () => {
    // Baseline: whichever product BM25 ranks first for "office chair".
    const baseline = await searchProducts(es, SHOP_INDEX, "office chair", { facets: true });
    const topId = Number(baseline.hits[0]?.id);
    const otherId = topId === 10 ? 20 : 10;
    expect(baseline.hits.map((h) => Number(h.id)).sort()).toEqual([10, 20]);

    // Boost the OTHER product hard; it must overtake the default winner.
    const boosted = await searchProducts(es, SHOP_INDEX, "office chair", {
      facets: true,
      affinityBoosts: [{ productId: otherId, weight: 50 }],
    });
    expect(Number(boosted.hits[0]?.id)).toBe(otherId);
  });

  it("leaves order unchanged when there are no boosts", async () => {
    const a = await searchProducts(es, SHOP_INDEX, "office chair", { facets: true });
    const b = await searchProducts(es, SHOP_INDEX, "office chair", {
      facets: true,
      affinityBoosts: [],
    });
    expect(b.hits.map((h) => h.id)).toEqual(a.hits.map((h) => h.id));
  });
});
