import { eq, synonymRules, type Db } from "@nordhem/db";
import { toSolrRule, type SynonymRule } from "./synonyms.ts";

/**
 * Load the enabled synonym rules from Postgres as Solr synonym_graph lines, the
 * same shape buildAnalysis expects. This is what replaces the static
 * synonyms.txt at index-settings build time once the table is seeded (Step 9),
 * and what the hot-reload path re-reads after an editor changes a rule.
 */
export async function loadSynonymRulesFromDb(db: Db): Promise<string[]> {
  const rows = await db
    .select()
    .from(synonymRules)
    .where(eq(synonymRules.enabled, true));
  return rows.map((r) =>
    toSolrRule({ kind: r.kind as SynonymRule["kind"], terms: r.terms, mapsTo: r.mapsTo }),
  );
}
