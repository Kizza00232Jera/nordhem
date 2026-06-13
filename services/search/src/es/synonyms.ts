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
