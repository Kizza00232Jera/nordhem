"use server";

import { logChange } from "../../lib/change-log-repo";
import { db } from "../../lib/db";
import { decideSuggestion } from "../../lib/suggestions-repo";
import { createSynonym } from "../../lib/synonyms-repo";

export type DecisionResult = { ok: true; message: string } | { ok: false; error: string };

function describe(s: { kind: string; terms: string; mapsTo: string | null }): string {
  return s.kind === "oneway" ? `${s.terms} → ${s.mapsTo}` : s.terms;
}

/**
 * Approve a suggestion: mark it approved and create a real (disabled-until-
 * Applied) synonym rule from it, tagged source 'suggested'. The editor still
 * has to Apply it on the Synonyms page to push it live, so the human stays in
 * the loop end to end.
 */
export async function approveSuggestionAction(id: number): Promise<DecisionResult> {
  const s = await decideSuggestion(db(), id, "approved");
  if (!s) return { ok: false, error: "Suggestion not found." };
  await createSynonym({ kind: s.kind, terms: s.terms, mapsTo: s.mapsTo }, "suggested");
  await logChange("synonym", "create", `Approved suggestion: ${describe(s)}`, {
    from: "suggestion",
    query: s.query,
    source: s.source,
  });
  return { ok: true, message: "Approved. Created a synonym rule; go to Synonyms and Apply to push it live." };
}

/** Reject a suggestion: mark it rejected, no rule created. */
export async function rejectSuggestionAction(id: number): Promise<DecisionResult> {
  const s = await decideSuggestion(db(), id, "rejected");
  if (!s) return { ok: false, error: "Suggestion not found." };
  await logChange("suggestion", "delete", `Rejected suggestion for "${s.query}": ${describe(s)}`);
  return { ok: true, message: "Rejected." };
}
