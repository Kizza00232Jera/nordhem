import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { SearchResponseSchema } from "@nordhem/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexProducts, indexShopDocuments, type ShopDocument } from "../../src/es/indexer.ts";
import { buildApp } from "../../src/server.ts";
import type { RawProduct } from "../../src/wands/parse.ts";

const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:9.3.1";
const INDEX = "products-facets-test";
const SHOP_INDEX = "products-shop-facets-test";

// Every fixture shares the token "oak", so a query for "oak" matches all of
// them and the category aggregation runs over a known set: 2 sofas, 1 bed.
// Counts that are hand-computable from the fixtures are the honest way to
// assert an aggregation (docs/TESTING.md rule 4).
const SHOP_FIXTURES: ShopDocument[] = [
  {
    product_id: 1,
    name: "oak two-seat sofa",
    product_class: "Sofas",
    description: "compact oak-framed sofa",
    slug: "oak-two-seat-sofa-1",
    category: "sofas",
    price_cents: 79999,
    image_thumb_url: null,
  },
  {
    product_id: 2,
    name: "oak three-seat sofa",
    product_class: "Sofas",
    description: "roomy oak-framed sofa",
    slug: "oak-three-seat-sofa-2",
    category: "sofas",
    price_cents: 99999,
    image_thumb_url: null,
  },
  {
    product_id: 3,
    name: "oak platform bed",
    product_class: "Beds",
    description: "solid oak bed frame",
    slug: "oak-platform-bed-3",
    category: "beds",
    price_cents: 119999,
    image_thumb_url: null,
  },
];

const PRODUCT_FIXTURES: RawProduct[] = [
  {
    productId: 1,
    name: "oak two-seat sofa",
    productClass: "Sofas",
    categoryHierarchy: null,
    description: "compact oak-framed sofa",
    features: null,
    ratingCount: null,
    averageRating: null,
    reviewCount: null,
  },
];

let container: StartedElasticsearchContainer;
let app: FastifyInstance;

beforeAll(async () => {
  container = await new ElasticsearchContainer(ES_IMAGE)
    .withEnvironment({
      "xpack.security.enabled": "false",
      "discovery.type": "single-node",
      ES_JAVA_OPTS: "-Xms512m -Xmx512m",
    })
    .start();
  const es = createEsClient(container.getHttpUrl());
  await indexProducts(es, INDEX, PRODUCT_FIXTURES);
  await indexShopDocuments(es, SHOP_INDEX, SHOP_FIXTURES);
  app = buildApp({ es, index: INDEX, shopIndex: SHOP_INDEX });
}, 120_000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

describe("facets: category terms aggregation", () => {
  it("returns a live category count over the products matching the query", async () => {
    const res = await app.inject({ url: "/search?q=oak&scope=shop" });

    expect(res.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(res.json());

    const counts = Object.fromEntries(
      (body.facets?.categories ?? []).map((b) => [b.value, b.count]),
    );
    expect(counts).toEqual({ sofas: 2, beds: 1 });
  });
});

describe("filtering: a selected category narrows the hits", () => {
  it("returns only products in the chosen category", async () => {
    const res = await app.inject({ url: "/search?q=oak&scope=shop&category=beds" });

    expect(res.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(res.json());
    expect(body.total).toBe(1);
    expect(body.hits.map((h) => h.category)).toEqual(["beds"]);
  });

  // Regression guard, not a tracer bullet: the category lives in bool.filter
  // (filter context — no scoring), so a product's _score must be identical
  // with and without the filter applied. If a refactor ever moved the filter
  // into `must`, this fails — that's the whole point of pinning it.
  it("does not change relevance scores (filter context, not query context)", async () => {
    const all = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop" })).json(),
    );
    const filtered = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop&category=beds" })).json(),
    );

    const bedScoreUnfiltered = all.hits.find((h) => h.category === "beds")?.score;
    const bedScoreFiltered = filtered.hits.find((h) => h.category === "beds")?.score;

    expect(bedScoreFiltered).toBeDefined();
    expect(bedScoreFiltered).toBe(bedScoreUnfiltered);
  });
});
