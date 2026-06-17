import { type Db, desc, eq, searchSuggestion } from "@nordhem/db";
import type { SynonymKind } from "./synonyms-rules";

/**
 * Step 11b: the AI editor assistant's approval queue. A dev-time Claude session
 * (or the heuristic generator) writes PENDING synonym suggestions; an editor
 * approves/rejects them in the studio. Approving creates a real synonym rule
 * (still has to be Applied), so a suggestion never ships on its own.
 */

export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface NewSuggestion {
  query: string;
  kind: SynonymKind;
  terms: string;
  mapsTo?: string | null;
  rationale: string;
  source: "ai" | "heuristic";
}

export interface SuggestionRow {
  id: number;
  query: string;
  kind: SynonymKind;
  terms: string;
  mapsTo: string | null;
  rationale: string;
  status: SuggestionStatus;
  source: string;
  createdAt: Date;
  decidedAt: Date | null;
}

function toRow(r: typeof searchSuggestion.$inferSelect): SuggestionRow {
  return {
    id: r.id,
    query: r.query,
    kind: r.kind as SynonymKind,
    terms: r.terms,
    mapsTo: r.mapsTo,
    rationale: r.rationale,
    status: r.status as SuggestionStatus,
    source: r.source,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
  };
}

/** Insert a pending suggestion; returns its id. */
export async function createSuggestion(db: Db, input: NewSuggestion): Promise<number> {
  const [row] = await db
    .insert(searchSuggestion)
    .values({
      query: input.query,
      kind: input.kind,
      terms: input.terms,
      mapsTo: input.kind === "oneway" ? (input.mapsTo ?? "").trim() : null,
      rationale: input.rationale,
      source: input.source,
    })
    .returning({ id: searchSuggestion.id });
  return row!.id;
}

/** List suggestions, optionally filtered by status, newest first. */
export async function listSuggestions(db: Db, status?: SuggestionStatus): Promise<SuggestionRow[]> {
  const base = db.select().from(searchSuggestion);
  const rows = await (status
    ? base.where(eq(searchSuggestion.status, status))
    : base
  ).orderBy(desc(searchSuggestion.createdAt), desc(searchSuggestion.id));
  return rows.map(toRow);
}

/** Approve or reject a suggestion; stamps decidedAt and returns the row. */
export async function decideSuggestion(
  db: Db,
  id: number,
  status: "approved" | "rejected",
): Promise<SuggestionRow | undefined> {
  const [row] = await db
    .update(searchSuggestion)
    .set({ status, decidedAt: new Date() })
    .where(eq(searchSuggestion.id, id))
    .returning();
  return row ? toRow(row) : undefined;
}

/** Count suggestions by status (for the page header / queue badge). */
export async function suggestionCounts(db: Db): Promise<Record<string, number>> {
  const rows = await db.select({ status: searchSuggestion.status }).from(searchSuggestion);
  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}
