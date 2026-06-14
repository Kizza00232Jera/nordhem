import { createDb, ensureSchema } from "@nordhem/db";
import { seedSynonyms } from "./synonyms-seed.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";

const { db, close } = createDb(databaseUrl);
try {
  await ensureSchema(db);
  const n = await seedSynonyms(db);
  console.log(
    n > 0
      ? `seeded ${n} synonym rules (synonyms.txt + catalog-mined)`
      : "synonym_rules already populated; left as-is",
  );
} finally {
  await close();
}
