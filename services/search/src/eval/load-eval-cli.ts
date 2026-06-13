import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDb, ensureSchema } from "@nordhem/db";
import { loadEvalSet } from "./load-eval.ts";
import { parseLabelsTsv, parseQueriesTsv } from "./wands.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const dataDir = path.resolve(import.meta.dirname, "../../../../data/wands");

const { db, close } = createDb(databaseUrl);
try {
  await ensureSchema(db);
  const queries = parseQueriesTsv(await readFile(path.join(dataDir, "query.csv"), "utf8"));
  const judgments = parseLabelsTsv(await readFile(path.join(dataDir, "label.csv"), "utf8"));
  const counts = await loadEvalSet(db, queries, judgments);
  console.log(`loaded ${counts.queries} queries and ${counts.judgments} judgments`);
} finally {
  await close();
}
