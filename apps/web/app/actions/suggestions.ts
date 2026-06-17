"use server";

import { isNotNull, productsRaw } from "@nordhem/db";
import { logChange } from "../../lib/change-log-repo";
import { zeroResultQueries } from "../../lib/analytics-repo";
import { getChatConfig } from "../../lib/chat/enabled";
import {
  buildGeneratorPrompt,
  completeText,
  parseSuggestionsJson,
} from "../../lib/chat/suggestions-generate";
import { db } from "../../lib/db";
import { createSuggestion, decideSuggestion, listSuggestions } from "../../lib/suggestions-repo";
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

/**
 * Automated AI generation: ask the configured model (API key or local
 * subscription) to propose synonyms for the zero-result queries, then write the
 * fresh ones to the SAME approval queue as source 'ai'. Nothing ships; a human
 * still reviews. Off unless the assistant is configured in Settings.
 */
export async function generateSuggestionsAction(): Promise<DecisionResult> {
  const config = await getChatConfig();
  if (!config) {
    return { ok: false, error: "Configure the assistant in Settings first (API key or subscription)." };
  }
  const zeros = await zeroResultQueries(db(), 15, "all");
  if (zeros.length === 0) {
    return { ok: false, error: "No zero-result queries to analyse yet." };
  }
  const catRows = await db()
    .selectDistinct({ pc: productsRaw.productClass })
    .from(productsRaw)
    .where(isNotNull(productsRaw.productClass))
    .limit(40);
  const catalogTerms = catRows.map((r) => r.pc).filter((x): x is string => typeof x === "string" && !!x);

  const { system, user } = buildGeneratorPrompt(zeros.map((z) => z.query), catalogTerms);
  let text: string;
  try {
    text = await completeText(config, system, user);
  } catch {
    return { ok: false, error: "The model call failed (check the key, or that the tutor server is running for subscription mode)." };
  }

  const proposals = parseSuggestionsJson(text);
  if (proposals.length === 0) {
    return { ok: false, error: "The model returned no usable suggestions." };
  }

  const existing = await listSuggestions(db());
  const taken = new Set(existing.filter((s) => s.status !== "rejected").map((s) => s.terms));
  let created = 0;
  for (const p of proposals) {
    if (taken.has(p.terms)) continue;
    await createSuggestion(db(), {
      query: p.query,
      kind: p.kind,
      terms: p.terms,
      mapsTo: p.mapsTo,
      rationale: p.rationale,
      source: "ai",
    });
    taken.add(p.terms);
    created += 1;
  }
  await logChange("suggestion", "create", `AI generated ${created} synonym suggestion(s)`, { from: "generator" });
  return { ok: true, message: `Generated ${created} new AI suggestion(s) for review.` };
}

/** Reject a suggestion: mark it rejected, no rule created. */
export async function rejectSuggestionAction(id: number): Promise<DecisionResult> {
  const s = await decideSuggestion(db(), id, "rejected");
  if (!s) return { ok: false, error: "Suggestion not found." };
  await logChange("suggestion", "delete", `Rejected suggestion for "${s.query}": ${describe(s)}`);
  return { ok: true, message: "Rejected." };
}
