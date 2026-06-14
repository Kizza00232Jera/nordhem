import { ElasticsearchContainer, type StartedElasticsearchContainer } from "@testcontainers/elasticsearch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEsClient } from "../../src/es/client.ts";
import { indexProducts, reloadSynonyms } from "../../src/es/indexer.ts";
import { lexicalProductIds } from "../../src/search/semantic.ts";
import type { RawProduct } from "../../src/wands/parse.ts";

const ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:9.3.1";
const INDEX = "products-synonyms-reload-test";

function makeProduct(o: Partial<RawProduct> & Pick<RawProduct, "productId" | "name">): RawProduct {
  return {
    productClass: null, categoryHierarchy: null, description: null, features: null,
    ratingCount: null, averageRating: null, reviewCount: null, ...o,
  };
}

// "futon" and "sofa bed" share no word; no seed rule connects them. The hot
// reload adds that synonym at runtime and the search starts matching, with the
// documents never reindexed.
const FIXTURES: RawProduct[] = [
  makeProduct({ productId: 1, name: "tokyo futon", description: "a foldable futon for small spaces" }),
  makeProduct({ productId: 2, name: "oak dining table", description: "solid wood table" }),
];

describe("synonyms hot-reload (no reindex)", () => {
  let es: ReturnType<typeof createEsClient>;
  let container: StartedElasticsearchContainer;

  beforeAll(async () => {
    container = await new ElasticsearchContainer(ES_IMAGE)
      .withEnvironment({ "xpack.security.enabled": "false" })
      .withStartupTimeout(180_000)
      .start();
    es = createEsClient(container.getHttpUrl());
    await indexProducts(es, INDEX, FIXTURES); // default (file) synonyms: no futon rule
  }, 300_000);

  afterAll(async () => {
    await es?.indices.delete({ index: INDEX }).catch(() => {});
    await container?.stop();
  });

  it("does not match the futon for 'sofa bed' before the rule exists", async () => {
    const ids = await lexicalProductIds(es, INDEX, "sofa bed", 10);
    expect(ids).not.toContain(1);
  });

  it("matches it after hot-reloading the synonym, with the docs untouched", async () => {
    await reloadSynonyms(es, INDEX, ["sofa bed, futon"]);
    const ids = await lexicalProductIds(es, INDEX, "sofa bed", 10);
    expect(ids).toContain(1); // the synonym now bridges sofa bed -> futon

    // The documents were never reindexed: both are still present.
    const { count } = await es.count({ index: INDEX });
    expect(count).toBe(2);
  });

  it("skips a malformed rule instead of breaking the whole analyzer (lenient)", async () => {
    // "chest of drawers" loses the stopword "of" to the analyzer, leaving a
    // position gap that synonym_graph rejects. Without lenient it would fail
    // the entire reload; with lenient it is dropped and the good rule applies.
    await reloadSynonyms(es, INDEX, ["chest of drawers, dresser", "sofa bed, futon"]);
    const ids = await lexicalProductIds(es, INDEX, "sofa bed", 10);
    expect(ids).toContain(1); // the good rule survived the malformed one
  });
});
