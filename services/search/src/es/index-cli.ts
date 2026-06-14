import { createDb, productsRaw } from "@nordhem/db";
import { createEsClient } from "./client.ts";
import { indexProducts } from "./indexer.ts";
import { loadSynonymRulesFromDb } from "./synonyms-db.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";

// Pass --embed to compute and store the e5 vector for every product (Step 8).
// This is the slow one-time batch (~30-40 min over the 43k benchmark); plain
// text-only indexing stays the default so earlier flows are unchanged.
const embed = process.argv.includes("--embed");

const { db, close } = createDb(databaseUrl);
try {
  const products = await db.select().from(productsRaw);
  console.log(`read ${products.length} products from postgres`);
  // Synonyms come from Postgres (Step 9); empty table falls back to synonyms.txt.
  const synonymRules = await loadSynonymRulesFromDb(db);
  console.log(`loaded ${synonymRules.length} synonym rules from postgres`);
  const es = createEsClient(esUrl);
  const started = Date.now();
  const indexed = await indexProducts(es, index, products, {
    embed,
    synonymRules: synonymRules.length > 0 ? synonymRules : undefined,
    onEmbedProgress: (done, total) => {
      if (done % 5120 === 0 || done === total) {
        const secs = ((Date.now() - started) / 1000).toFixed(0);
        console.log(`  embedded ${done}/${total} (${secs}s elapsed)`);
      }
    },
  });
  console.log(
    `indexed ${indexed} products into "${index}"${embed ? " with embeddings" : ""} in ${((Date.now() - started) / 1000).toFixed(0)}s`,
  );
} finally {
  await close();
}
