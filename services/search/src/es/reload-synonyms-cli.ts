import { createDb } from "@nordhem/db";
import { createEsClient } from "./client.ts";
import { reloadSynonyms } from "./indexer.ts";
import { loadSynonymRulesFromDb } from "./synonyms-db.ts";

// Apply the current Postgres synonym rules to the live indexes' search analyzer,
// with no reindex (Step 9). This is what the studio "Apply" button triggers.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";
const shopIndex = process.env.SHOP_INDEX ?? "products-shop";

const { db, close } = createDb(databaseUrl);
try {
  const rules = await loadSynonymRulesFromDb(db);
  const es = createEsClient(esUrl);
  for (const target of [index, shopIndex]) {
    if (await es.indices.exists({ index: target })) {
      const started = Date.now();
      await reloadSynonyms(es, target, rules);
      console.log(`reloaded ${rules.length} synonym rules into "${target}" in ${Date.now() - started}ms`);
    } else {
      console.log(`skipped "${target}" (does not exist)`);
    }
  }
} finally {
  await close();
}
