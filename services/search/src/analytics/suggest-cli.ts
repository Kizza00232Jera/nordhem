import {
  and,
  createDb,
  ensureSchema,
  eq,
  isNotNull,
  productsRaw,
  searchEvents,
  searchSuggestion,
} from "@nordhem/db";
import { proposeSynonyms, type SuggestionCandidate } from "./suggest.ts";

/**
 * Step 11b heuristic generator (the demoable path that needs no AI session).
 * Reads logged zero-result queries, compares them to the catalog's product-class
 * vocabulary, and writes high-confidence one-way synonym suggestions to the
 * approval queue for an editor to review. Idempotent-ish: it skips any proposal
 * whose terms already exist as a pending or approved suggestion.
 *
 *   pnpm -F @nordhem/search suggest-synonyms [--threshold 0.5] [--dry-run]
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";

function numFlag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const threshold = numFlag("threshold", 0.5);
const dryRun = process.argv.includes("--dry-run");

const { db, close } = createDb(databaseUrl);
try {
  await ensureSchema(db);

  // Zero-result queries are the candidates; product classes are the vocabulary.
  const zeroRows = await db
    .selectDistinct({ query: searchEvents.query })
    .from(searchEvents)
    .where(and(eq(searchEvents.type, "search"), eq(searchEvents.zeroResult, true)));
  const candidates: SuggestionCandidate[] = zeroRows.map((r) => ({ query: r.query }));

  const classRows = await db
    .selectDistinct({ pc: productsRaw.productClass })
    .from(productsRaw)
    .where(isNotNull(productsRaw.productClass));
  const catalogTerms = classRows
    .map((r) => r.pc)
    .filter((x): x is string => typeof x === "string" && x.length > 0);

  const proposals = proposeSynonyms(candidates, catalogTerms, { threshold });

  // Skip anything already proposed (pending) or accepted (approved).
  const existing = await db
    .select({ terms: searchSuggestion.terms, status: searchSuggestion.status })
    .from(searchSuggestion);
  const taken = new Set(existing.filter((e) => e.status !== "rejected").map((e) => e.terms));
  const fresh = proposals.filter((p) => !taken.has(p.terms));

  console.log(
    `scanned ${candidates.length} zero-result queries against ${catalogTerms.length} catalog terms ` +
      `(threshold ${threshold}) -> ${proposals.length} proposals, ${fresh.length} new`,
  );
  for (const p of fresh.slice(0, 15)) {
    console.log(`  ${p.terms} -> ${p.mapsTo}  (${(p.similarity * 100).toFixed(0)}%)`);
  }

  if (dryRun) {
    console.log("dry run: nothing written to the approval queue");
  } else if (fresh.length) {
    await db.insert(searchSuggestion).values(
      fresh.map((p) => ({
        query: p.query,
        kind: p.kind,
        terms: p.terms,
        mapsTo: p.mapsTo,
        rationale: p.rationale,
        source: "heuristic",
      })),
    );
    console.log(`wrote ${fresh.length} pending suggestions to the approval queue`);
  } else {
    console.log("no new suggestions to write");
  }
} finally {
  await close();
}
