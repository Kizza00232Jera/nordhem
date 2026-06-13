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
    color: "white",
    material: "fabric",
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
    color: "white",
    material: "velvet",
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
    color: "black",
    material: "oak",
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

describe("facets: colour and material terms aggregations", () => {
  it("counts colours and materials over the matching products", async () => {
    const body = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop" })).json(),
    );

    const colors = Object.fromEntries(
      (body.facets?.colors ?? []).map((b) => [b.value, b.count]),
    );
    const materials = Object.fromEntries(
      (body.facets?.materials ?? []).map((b) => [b.value, b.count]),
    );
    expect(colors).toEqual({ white: 2, black: 1 });
    expect(materials).toEqual({ fabric: 1, velvet: 1, oak: 1 });
  });
});

describe("sorting and pagination", () => {
  it("sorts by price ascending", async () => {
    const body = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop&sort=price_asc" })).json(),
    );
    expect(body.hits.map((h) => h.slug)).toEqual([
      "oak-two-seat-sofa-1", // 79999
      "oak-three-seat-sofa-2", // 99999
      "oak-platform-bed-3", // 119999
    ]);
  });

  it("paginates: page 2 returns the next slice, total unchanged", async () => {
    const page1 = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop&sort=price_asc&size=2&page=1" })).json(),
    );
    const page2 = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop&sort=price_asc&size=2&page=2" })).json(),
    );

    expect(page1.total).toBe(3);
    expect(page2.total).toBe(3);
    expect(page1.hits.map((h) => h.slug)).toEqual([
      "oak-two-seat-sofa-1",
      "oak-three-seat-sofa-2",
    ]);
    expect(page2.hits.map((h) => h.slug)).toEqual(["oak-platform-bed-3"]);
  });
});

describe("facets: price range bands", () => {
  // Fixture prices: 79999 and 99999 fall in the 500-1000 band; 119999 in
  // 1000-2000. Bands are fixed (cents): under-500 <50000, 500-1000, etc.
  it("counts products into the fixed price bands", async () => {
    const body = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop" })).json(),
    );

    const bands = Object.fromEntries(
      (body.facets?.prices ?? []).map((b) => [b.key, b.count]),
    );
    expect(bands).toEqual({
      "under-500": 0,
      "500-1000": 2,
      "1000-2000": 1,
      "2000-plus": 0,
    });
  });
});

describe("filtering: a price range narrows the hits", () => {
  it("keeps only products at or above the minimum price", async () => {
    const body = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop&priceMin=100000" })).json(),
    );

    expect(body.total).toBe(1);
    expect(body.hits[0]?.slug).toBe("oak-platform-bed-3");
  });
});

describe("multi-select: a colour selection narrows hits but keeps its own counts", () => {
  // The post_filter lever: a multi-select facet's own selection is applied
  // AFTER the aggregations, so the colour facet still lists every colour
  // (you can add black to white), while the returned hits are white-only.
  it("returns only white products yet the colour facet still shows black", async () => {
    const body = SearchResponseSchema.parse(
      (await app.inject({ url: "/search?q=oak&scope=shop&color=white" })).json(),
    );

    // Hits are narrowed to the two white sofas.
    expect(body.total).toBe(2);
    expect(body.hits.map((h) => h.slug).sort()).toEqual([
      "oak-three-seat-sofa-2",
      "oak-two-seat-sofa-1",
    ]);

    // But the colour facet still offers black with its count — the whole
    // point of post_filter (a bool.filter here would zero it out).
    const colors = Object.fromEntries(
      (body.facets?.colors ?? []).map((b) => [b.value, b.count]),
    );
    expect(colors).toEqual({ white: 2, black: 1 });
  });
});
