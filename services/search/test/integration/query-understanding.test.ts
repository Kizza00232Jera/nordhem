import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { SearchResponseSchema } from "@nordhem/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexProducts } from "../../src/es/indexer.ts";
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
});
