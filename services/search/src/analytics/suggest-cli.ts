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
 * approval queue for an editor to review.
 *
 * CRUCIAL: every proposal is VERIFIED against the live search engine before it
 * is kept. We only suggest a synonym when the query GENUINELY returns nothing
 * through the real analyzer AND the proposed target genuinely returns products.
 * That single check throws out everything the English stemmer and fuzziness
 * already solve (plurals like pillow/pillows, typos like adirondac/adirondack),
 * so the queue is never cluttered with synonyms that would change nothing. What
 * survives is real vocabulary gaps the analyzer cannot bridge (compound splits,
 * brand/foreign terms). Needs the search service running (SEARCH_API_URL).
 *
 *   pnpm -F @nordhem/search suggest-synonyms [--threshold 0.5] [--dry-run]
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const searchApiUrl = process.env.SEARCH_API_URL ?? "http://localhost:3001";

/** Hits a query returns through the live analyzer (shop scope), or null if the
 * search service is unreachable. */
async function liveTotal(query: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${searchApiUrl}/search?q=${encodeURIComponent(query)}&scope=shop&size=1`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { total?: number };
    return typeof data.total === "number" ? data.total : null;
  } catch {
    return null;
  }
}

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
      `(threshold ${threshold}) -> ${proposals.length} trigram matches, ${fresh.length} new; verifying...`,
  );

  // Verify against the live analyzer: drop anything the engine already resolves.
  const verified: typeof fresh = [];
  for (const p of fresh) {
    const qHits = await liveTotal(p.query);
    const tHits = await liveTotal(p.mapsTo);
    if (qHits === null || tHits === null) {
      console.error("search service unreachable; cannot verify. Nothing written. Start it with: pnpm -F @nordhem/search dev");
      process.exitCode = 1;
      break;
    }
    if (qHits === 0 && tHits > 0) {
      verified.push(p);
      console.log(`  keep ${p.terms} -> ${p.mapsTo} (${(p.similarity * 100).toFixed(0)}%; query 0 hits, target ${tHits})`);
    } else {
      console.log(`  drop ${p.terms} -> ${p.mapsTo} (analyzer already returns ${qHits} for the query)`);
    }
  }

  if (process.exitCode === 1) {
    // verification aborted; do not write
  } else if (dryRun) {
    console.log(`dry run: ${verified.length} verified suggestions NOT written`);
  } else if (verified.length) {
    await db.insert(searchSuggestion).values(
      verified.map((p) => ({
        query: p.query,
        kind: p.kind,
        terms: p.terms,
        mapsTo: p.mapsTo,
        rationale: `"${p.query}" genuinely returns no results through the live analyzer but is ${(p.similarity * 100).toFixed(0)}% similar to the catalog term "${p.mapsTo}", which does return products`,
        source: "heuristic",
      })),
    );
    console.log(`wrote ${verified.length} verified suggestions to the approval queue`);
  } else {
    console.log("no suggestions survived verification (the analyzer already handles every candidate)");
  }
} finally {
  await close();
}
