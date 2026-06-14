"use server";

import { revalidatePath } from "next/cache";
import { logChange } from "../../lib/change-log-repo";
import {
  createSynonym,
  deleteSynonym,
  setSynonymEnabled,
  updateSynonym,
  validateSynonymRule,
  type SynonymInput,
} from "../../lib/synonyms-repo";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";
const PATH = "/studio/relevance/synonyms";

function summarize(input: SynonymInput): string {
  const kind = input.kind === "oneway" ? "one-way" : "equivalent";
  const tail = input.kind === "oneway" ? ` => ${(input.mapsTo ?? "").trim()}` : "";
  return `${kind} rule: ${input.terms.trim()}${tail}`;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Create a rule. Validation errors block the save; the rule lands disabled-able. */
export async function createSynonymAction(input: SynonymInput): Promise<ActionResult> {
  const v = validateSynonymRule(input);
  if (!v.ok) return { ok: false, error: v.error ?? "Invalid rule." };
  await createSynonym(input);
  await logChange("synonym", "create", `Added ${summarize(input)}`);
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateSynonymAction(id: string, input: SynonymInput): Promise<ActionResult> {
  const v = validateSynonymRule(input);
  if (!v.ok) return { ok: false, error: v.error ?? "Invalid rule." };
  await updateSynonym(id, input);
  await logChange("synonym", "update", `Edited ${summarize(input)}`);
  revalidatePath(PATH);
  return { ok: true };
}

export async function toggleSynonymAction(id: string, enabled: boolean): Promise<void> {
  await setSynonymEnabled(id, enabled);
  await logChange("synonym", "update", `${enabled ? "Enabled" : "Disabled"} a synonym rule`);
  revalidatePath(PATH);
}

export async function deleteSynonymAction(id: string): Promise<void> {
  await deleteSynonym(id);
  await logChange("synonym", "delete", "Removed a synonym rule");
  revalidatePath(PATH);
}

export type ApplyResult = { ok: true; applied: number } | { ok: false; error: string };

/**
 * Push the saved rules to the live search analyzer (hot-reload, no reindex).
 * Saving a rule only changes Postgres; this is the explicit "make it live" step,
 * which mirrors the draft -> publish split real merchandising tools use.
 */
export async function applySynonymsAction(): Promise<ApplyResult> {
  try {
    const res = await fetch(`${SEARCH_API_URL}/synonyms/reload`, { method: "POST" });
    if (!res.ok) return { ok: false, error: `Reload failed (HTTP ${res.status}).` };
    const d = (await res.json()) as { applied: number };
    await logChange("apply", "apply", `Applied ${d.applied} synonym rules to live search`);
    return { ok: true, applied: d.applied };
  } catch {
    return { ok: false, error: "Could not reach the search service. Is it running?" };
  }
}

export type ImpactResult =
  | { ok: true; ndcg: number; mrr: number; recall: number; queryCount: number }
  | { ok: false; error: string };

/**
 * Benchmark the current saved synonyms against the judged set before applying
 * them to the storefront, the "test before you publish" check. Runs on the lab
 * (benchmark) index, not the shop.
 */
export async function synonymsImpactAction(): Promise<ImpactResult> {
  try {
    const res = await fetch(`${SEARCH_API_URL}/synonyms/impact`, { method: "POST" });
    if (!res.ok) return { ok: false, error: `Impact check failed (HTTP ${res.status}).` };
    const d = (await res.json()) as { ndcg: number; mrr: number; recall: number; queryCount: number };
    return { ok: true, ndcg: d.ndcg, mrr: d.mrr, recall: d.recall, queryCount: d.queryCount };
  } catch {
    return { ok: false, error: "Could not reach the search service." };
  }
}
