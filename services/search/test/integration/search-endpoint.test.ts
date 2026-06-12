import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { SearchResponseSchema } from "@nordhem/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexProducts } from "../../src/es/indexer.ts";
import { buildApp } from "../../src/server.ts";
import type { RawProduct } from "../../src/wands/parse.ts";

const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:9.3.1";
const INDEX = "products-test";

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
    name: "velvet accent chair",
    productClass: "Accent Chairs",
    description: "plush emerald velvet chair for the living room",
  }),
  makeProduct({
    productId: 2,
    name: "mesh task chair",
    productClass: "Office Chairs",
    description: "ergonomic office chair with lumbar support",
  }),
  makeProduct({
    productId: 3,
    name: "solid wood platform bed",
    productClass: "Beds",
    description: "acacia wood bed frame with headboard",
  }),
  makeProduct({
    productId: 4,
    name: "linen duvet cover",
    productClass: "Duvet Covers",
    description: "stonewashed linen bedding",
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
  app = buildApp({ es, index: INDEX });
});

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

describe("GET /search", () => {
  it("returns contract-valid chair hits and excludes non-matches", async () => {
    const res = await app.inject({ url: "/search?q=chair" });

    expect(res.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(res.json());
    expect(body.query).toBe("chair");
    expect(body.mode).toBe("full");
    expect(body.total).toBe(2);

    const names = body.hits.map((h) => h.name);
    expect(names).toContain("velvet accent chair");
    expect(names).toContain("mesh task chair");
    expect(names).not.toContain("solid wood platform bed");

    const scores = body.hits.map((h) => h.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("ranks the full-phrase name match first for a specific query", async () => {
    const res = await app.inject({ url: "/search?q=velvet accent chair" });

    const body = SearchResponseSchema.parse(res.json());
    expect(body.hits[0]?.name).toBe("velvet accent chair");
  });

  it("returns an empty, well-formed response for a zero-result query", async () => {
    const res = await app.inject({ url: "/search?q=quantum flux capacitor" });

    expect(res.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(res.json());
    expect(body.total).toBe(0);
    expect(body.hits).toEqual([]);
  });

  it("rejects a missing or blank q with 400", async () => {
    expect((await app.inject({ url: "/search" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/search?q=" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/search?q=%20%20" })).statusCode).toBe(400);
  });
});
