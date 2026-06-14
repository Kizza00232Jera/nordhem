import { readFileSync } from "node:fs";

/**
 * Synonyms v1 (D-step-3): a Solr-format rule file versioned in git,
 * applied query-time via the english_search analyzer. Step 9 moves the
 * rules to Postgres with an editor UI and hot reload — the file is the
 * bootstrap, not the destination.
 */
const SYNONYMS_FILE = new URL("../../synonyms.txt", import.meta.url);

export function parseSynonymRules(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function loadSynonymRules(): string[] {
  return parseSynonymRules(readFileSync(SYNONYMS_FILE, "utf8"));
}

/**
 * A synonym rule as the studio editor and the database hold it: an
 * `equivalent` group (all terms interchangeable) or a `oneway` rule (the LHS
 * terms map TO the RHS, but not back). This structured form is what an editor
 * renders; Elasticsearch wants the Solr line, so the two convert below.
 */
export interface SynonymRule {
  kind: "equivalent" | "oneway";
  /** Equivalent: the whole comma list. One-way: the left-hand terms. */
  terms: string;
  /** One-way only: the term the LHS maps to. */
  mapsTo?: string | null;
}

/**
 * Render a structured rule as a Solr synonym_graph line, exactly what the
 * analyzer consumes. Equivalent stays a comma list; one-way uses ` => `.
 * Getting this wrong silently breaks synonyms (no error, worse recall), so it
 * is a pure function pinned by unit tests.
 */
export function toSolrRule(rule: SynonymRule): string {
  const terms = rule.terms.trim();
  if (rule.kind === "oneway") return `${terms} => ${(rule.mapsTo ?? "").trim()}`;
  return terms;
}

/** Parse a Solr synonym_graph line back into a structured rule (for the editor). */
export function parseSolrRule(line: string): SynonymRule {
  const arrow = line.indexOf("=>");
  if (arrow !== -1) {
    return {
      kind: "oneway",
      terms: line.slice(0, arrow).trim(),
      mapsTo: line.slice(arrow + 2).trim(),
    };
  }
  return { kind: "equivalent", terms: line.trim(), mapsTo: null };
}
