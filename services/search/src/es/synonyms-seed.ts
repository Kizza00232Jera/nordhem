import { synonymRules, type Db } from "@nordhem/db";
import { loadSynonymRules, parseSolrRule, type SynonymRule } from "./synonyms.ts";

/**
 * Synonyms mined from the NORDHEM catalog itself (Step 9), not generic lists.
 * Found by reading the product taxonomy and descriptions: terms shoppers use
 * that the catalog spells only one way. Equivalent groups for true two-way
 * synonyms; one-way rules to EXTEND an existing seed group without creating a
 * second overlapping group (e.g. night table -> nightstand). "chase lounge" is
 * the common misspelling of chaise lounge, and the catalog has ~105 chaises.
 */
const CATALOG_MINED: SynonymRule[] = [
  { kind: "equivalent", terms: "chaise, chaise lounge, chaise longue, chase lounge" },
  { kind: "equivalent", terms: "dresser, chest of drawers, bureau" },
  { kind: "equivalent", terms: "console table, sofa table" },
  { kind: "equivalent", terms: "sideboard, credenza, buffet" },
  { kind: "equivalent", terms: "coffee table, cocktail table" },
  { kind: "equivalent", terms: "curtains, drapes, drapery" },
  { kind: "oneway", terms: "night table", mapsTo: "nightstand" },
  { kind: "oneway", terms: "hassock", mapsTo: "ottoman" },
  { kind: "oneway", terms: "bookshelf, bookshelves", mapsTo: "bookcase" },
];

/**
 * Populate synonym_rules once: the synonyms.txt lines as `seed`, plus the
 * catalog-mined groups as `catalog-mined`. Idempotent and non-destructive: if
 * the table already has rules (an editor has been at work), it leaves them
 * alone and returns 0.
 */
export async function seedSynonyms(db: Db): Promise<number> {
  const existing = await db.select({ id: synonymRules.id }).from(synonymRules).limit(1);
  if (existing.length > 0) return 0;

  const fileRules = loadSynonymRules().map((line) => {
    const r = parseSolrRule(line);
    return { kind: r.kind, terms: r.terms, mapsTo: r.mapsTo ?? null, source: "seed" };
  });
  const mined = CATALOG_MINED.map((r) => ({
    kind: r.kind,
    terms: r.terms,
    mapsTo: r.mapsTo ?? null,
    source: "catalog-mined",
  }));

  const rows = [...fileRules, ...mined];
  await db.insert(synonymRules).values(rows);
  return rows.length;
}
