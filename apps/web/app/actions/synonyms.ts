"use server";

import { revalidatePath } from "next/cache";
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

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Create a rule. Validation errors block the save; the rule lands disabled-able. */
export async function createSynonymAction(input: SynonymInput): Promise<ActionResult> {
  const v = validateSynonymRule(input);
  if (!v.ok) return { ok: false, error: v.error ?? "Invalid rule." };
  await createSynonym(input);
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateSynonymAction(id: string, input: SynonymInput): Promise<ActionResult> {
  const v = validateSynonymRule(input);
  if (!v.ok) return { ok: false, error: v.error ?? "Invalid rule." };
  await updateSynonym(id, input);
  revalidatePath(PATH);
  return { ok: true };
}

export async function toggleSynonymAction(id: string, enabled: boolean): Promise<void> {
  await setSynonymEnabled(id, enabled);
  revalidatePath(PATH);
}

export async function deleteSynonymAction(id: string): Promise<void> {
  await deleteSynonym(id);
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
    return { ok: true, applied: d.applied };
  } catch {
    return { ok: false, error: "Could not reach the search service. Is it running?" };
  }
}
