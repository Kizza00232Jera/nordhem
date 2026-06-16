import { asc, eq, synonymRules } from "@nordhem/db";
import { db } from "./db";
import { splitTerms, type SynonymInput, type SynonymKind } from "./synonyms-rules";

export type { SynonymInput, SynonymKind } from "./synonyms-rules";
export { validateSynonymRule } from "./synonyms-rules";

export interface SynonymRow {
  id: string;
  kind: SynonymKind;
  terms: string;
  mapsTo: string | null;
  enabled: boolean;
  source: string;
}

/** All rules, grouped by source then kind then terms for a stable ledger. */
export async function listSynonyms(): Promise<SynonymRow[]> {
  const rows = await db()
    .select()
    .from(synonymRules)
    .orderBy(asc(synonymRules.source), asc(synonymRules.kind), asc(synonymRules.terms));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as SynonymKind,
    terms: r.terms,
    mapsTo: r.mapsTo,
    enabled: r.enabled,
    source: r.source,
  }));
}

export async function createSynonym(input: SynonymInput, source = "manual"): Promise<void> {
  await db().insert(synonymRules).values({
    kind: input.kind,
    terms: splitTerms(input.terms).join(", "),
    mapsTo: input.kind === "oneway" ? (input.mapsTo ?? "").trim() : null,
    source,
  });
}

export async function updateSynonym(id: string, input: SynonymInput): Promise<void> {
  await db()
    .update(synonymRules)
    .set({
      kind: input.kind,
      terms: splitTerms(input.terms).join(", "),
      mapsTo: input.kind === "oneway" ? (input.mapsTo ?? "").trim() : null,
      updatedAt: new Date(),
    })
    .where(eq(synonymRules.id, id));
}

export async function setSynonymEnabled(id: string, enabled: boolean): Promise<void> {
  await db()
    .update(synonymRules)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(synonymRules.id, id));
}

export async function deleteSynonym(id: string): Promise<void> {
  await db().delete(synonymRules).where(eq(synonymRules.id, id));
}
