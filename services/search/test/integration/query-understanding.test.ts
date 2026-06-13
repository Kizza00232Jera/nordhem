import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { AutocompleteResponseSchema, SearchResponseSchema } from "@nordhem/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexProducts, indexShopDocuments, type ShopDocument } from "../../src/es/indexer.ts";
import { buildApp } from "../../src/server.ts";
import type { RawProduct } from "../../src/wands/parse.ts";

const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:9.3.1";
const INDEX = "products-qu-test";
const SHOP_INDEX = "products-shop-qu-test";

function makeProduct(overrides: Partial<RawProduct> & Pick<RawProduct, "productId" | "name">): RawProduct {
  return {
    productClass: null,
    categoryHierarchy: null,
    description: null,
    features: null,
    ratingCount: null,
    averageRating: null,
    reviewCount: null,
    ...overrides,
  };
}

const FIXTURES: RawProduct[] = [
  makeProduct({
    productId: 1,
    name: "solid wood platform bed",
    productClass: "Beds",
    description: "acacia wood bed frame with headboard",
  }),
  makeProduct({
    productId: 2,
    name: "velvet accent chair",
    productClass: "Accent Chairs",
    description: "plush emerald velvet chair for the living room",
  }),
  makeProduct({
    productId: 3,
    name: "three-seat fabric sofa",
    productClass: "Sofas",
    description: "deep-seated fabric sofa in oat boucle",
  }),
];

const SHOP_FIXTURES: ShopDocument[] = [
  {
    product_id: 2,
    name: "velvet accent chair",
    product_class: "Accent Chairs",
    description: "plush emerald velvet chair",
    slug: "velvet-accent-chair-2",
    category: "sofas",
    price_cents: 49999,
    image_thumb_url: "https://images.unsplash.com/photo-velvet?w=400",
    color: "green",
    material: "velvet",
  },
  {
    product_id: 3,
    name: "three-seat fabric sofa",
    product_class: "Sofas",
    description: "deep-seated fabric sofa in oat boucle",
    slug: "three-seat-fabric-sofa-3",
    category: "sofas",
    price_cents: 89999,
    image_thumb_url: null,
    color: "beige",
    material: "fabric",
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
  await indexProducts(es, INDEX, FIXTURES);
  await indexShopDocuments(es, SHOP_INDEX, SHOP_FIXTURES);
  app = buildApp({ es, index: INDEX, shopIndex: SHOP_INDEX });
});

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

describe("query understanding: analysis chain", () => {
  // "beds" would be a fake stemming test: product_class "Beds" matches it
  // verbatim under the standard analyzer. "headboards" only exists in the
  // corpus as singular "headboard", so only the stemmer can connect them.
  it('stems the query: "headboards" finds the bed with a headboard', async () => {
    const res = await app.inject({ url: "/search?q=headboards" });

    expect(res.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(res.json());
    expect(body.hits.map((h) => h.name)).toContain("solid wood platform bed");
  });

  // A single misspelled token is the honest fuzziness test — in a
  // multi-word typo query ("querry chair") the well-spelled word matches
  // on its own and proves nothing. "vellvet" is 7 chars / 1 insertion away
  // from "velvet"; AUTO grants 2 edits to terms longer than 5 chars.
  it('tolerates a typo: "vellvet" finds the velvet accent chair', async () => {
    const res = await app.inject({ url: "/search?q=vellvet" });

    const body = SearchResponseSchema.parse(res.json());
    expect(body.hits.map((h) => h.name)).toContain("velvet accent chair");
  });

  // Tests the REAL synonyms.txt (sofa, couch, settee) through the
  // query-time english_search analyzer — what ships is what's tested.
  // "couch" shares no tokens with the sofa fixture and is >1 edit from
  // every corpus term, so neither stemming nor fuzziness can fake this.
  it('expands synonyms: "couch" finds the fabric sofa', async () => {
    const res = await app.inject({ url: "/search?q=couch" });

    const body = SearchResponseSchema.parse(res.json());
    expect(body.hits.map((h) => h.name)).toContain("three-seat fabric sofa");
  });
});

describe("query understanding: did you mean", () => {
  it('suggests "platform bed" for the misspelling "platfrom bed"', async () => {
    const res = await app.inject({ url: "/search?q=platfrom bed" });

    expect(res.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(res.json());
    expect(body.suggestion).toBe("platform bed");
  });

  it("offers no suggestion for a well-spelled query", async () => {
    const res = await app.inject({ url: "/search?q=velvet accent chair" });

    const body = SearchResponseSchema.parse(res.json());
    expect(body.suggestion).toBeUndefined();
  });
});

describe("GET /autocomplete", () => {
  // search_as_you_type + bool_prefix: the last word is matched as a
  // prefix, completed words are matched normally.
  it('completes the prefix "vel" to the velvet chair with card fields', async () => {
    const res = await app.inject({ url: "/autocomplete?q=vel&scope=shop" });

    expect(res.statusCode).toBe(200);
    const body = AutocompleteResponseSchema.parse(res.json());
    expect(body.suggestions[0]).toMatchObject({
      name: "velvet accent chair",
      slug: "velvet-accent-chair-2",
      priceCents: 49999,
      imageThumbUrl: "https://images.unsplash.com/photo-velvet?w=400",
    });
  });

  it('completes a mid-phrase prefix: "fabric so" finds the sofa', async () => {
    const res = await app.inject({ url: "/autocomplete?q=fabric so&scope=shop" });

    const body = AutocompleteResponseSchema.parse(res.json());
    expect(body.suggestions.map((s) => s.name)).toContain("three-seat fabric sofa");
  });

  it("rejects a missing q with 400", async () => {
    expect((await app.inject({ url: "/autocomplete" })).statusCode).toBe(400);
  });
});

describe("query understanding: highlighting", () => {
  it("marks the matched terms in name and description", async () => {
    const res = await app.inject({ url: "/search?q=velvet" });

    const body = SearchResponseSchema.parse(res.json());
    const hit = body.hits.find((h) => h.name === "velvet accent chair");
    expect(hit?.highlightName).toBe("<mark>velvet</mark> accent chair");
    expect(hit?.highlightDescription).toBe(
      "plush emerald <mark>velvet</mark> chair for the living room",
    );
  });
});
