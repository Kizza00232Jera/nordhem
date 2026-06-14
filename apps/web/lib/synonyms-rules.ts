// Pure synonym-rule logic, no database. Safe to import from a client component
// (the editor uses validateSynonymRule for a live warning) and from the repo.

export type SynonymKind = "equivalent" | "oneway";

export interface SynonymInput {
  kind: SynonymKind;
  terms: string;
  mapsTo?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

// The English stop filter drops these, which breaks a multi-word synonym term
// (the gap makes synonym_graph reject it). We don't block — the analyzer is
// lenient — but we warn so the editor can rephrase instead of silently losing
// the rule. This is the lesson from "chest of drawers" breaking the build.
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in",
  "into", "is", "it", "of", "on", "or", "such", "that", "the", "their", "then",
  "there", "these", "they", "this", "to", "was", "will", "with",
]);

export function splitTerms(terms: string): string[] {
  return terms.split(",").map((t) => t.trim()).filter(Boolean);
}

function phraseHasStopword(phrase: string): boolean {
  const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 1 && words.some((w) => STOPWORDS.has(w));
}

/**
 * Validate a rule before it is saved. An error blocks the save; a warning lets
 * it through but flags that the analyzer may skip it at index time.
 */
export function validateSynonymRule(input: SynonymInput): ValidationResult {
  const terms = splitTerms(input.terms);
  const mapsTo = (input.mapsTo ?? "").trim();

  if (input.kind === "equivalent") {
    if (terms.length < 2) {
      return { ok: false, error: "An equivalent group needs at least two comma-separated terms." };
    }
  } else {
    if (terms.length < 1) return { ok: false, error: "A one-way rule needs at least one term on the left." };
    if (!mapsTo) return { ok: false, error: "A one-way rule needs a target term it maps to." };
  }

  const offender = [...terms, mapsTo].find(phraseHasStopword);
  if (offender) {
    return {
      ok: true,
      warning: `"${offender}" contains a common word the analyzer drops (like "of" or "the"), so this rule may be skipped. Consider rephrasing without it.`,
    };
  }
  return { ok: true };
}
