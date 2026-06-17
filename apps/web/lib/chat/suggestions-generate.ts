import type { ResolvedChatConfig } from "./config";
import { openAiCompatibleClient } from "./provider";

/**
 * The automated AI suggestion generator. Asks the configured model (API key or
 * the local subscription bridge) to propose synonyms for problem queries, parses
 * its JSON, and the caller writes them to the SAME human-approval queue as the
 * heuristic and manual paths. The LLM proposes; a human still disposes.
 */

export interface ProposedSuggestion {
  query: string;
  kind: "equivalent" | "oneway";
  terms: string;
  mapsTo: string | null;
  rationale: string;
}

/** Pull the JSON array out of a model reply (which may wrap it in prose/fences)
 * and keep only items that match the SynonymInput shape. */
export function parseSuggestionsJson(text: string): ProposedSuggestion[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  const out: ProposedSuggestion[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.query !== "string" || !o.query.trim()) continue;
    if (o.kind !== "equivalent" && o.kind !== "oneway") continue;
    if (typeof o.terms !== "string" || !o.terms.trim()) continue;
    out.push({
      query: o.query.trim(),
      kind: o.kind,
      terms: o.terms.trim(),
      mapsTo: o.kind === "oneway" && typeof o.mapsTo === "string" ? o.mapsTo.trim() : null,
      rationale: typeof o.rationale === "string" && o.rationale.trim() ? o.rationale.trim() : "AI suggestion",
    });
  }
  return out;
}

const TUTOR_URL = process.env.TUTOR_URL ?? "http://127.0.0.1:8765";

/** One non-tool completion, via whichever backend is configured. */
export async function completeText(
  config: ResolvedChatConfig,
  system: string,
  user: string,
): Promise<string> {
  if (config.mode === "api") {
    const client = openAiCompatibleClient(config);
    const res = await client.complete(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      [],
    );
    return res.content;
  }
  // subscription: the local claude CLI via the tutor server
  const res = await fetch(`${TUTOR_URL}/tutor`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      system,
      messages: [{ role: "user", content: user }],
      tools: [],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`tutor server responded ${res.status}`);
  const data = (await res.json()) as { text?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return String(data.text ?? "");
}

/** Build the generator prompt from the problem queries and catalog vocabulary. */
export function buildGeneratorPrompt(
  problemQueries: string[],
  catalogTerms: string[],
): { system: string; user: string } {
  const system =
    "You are a search relevance expert for NORDHEM, a Nordic furniture and home-goods store. " +
    "You propose synonyms and one-way query rewrites that improve search recall without hurting precision. " +
    "Reply with ONLY a JSON array, no prose.";
  const user = [
    "These shopper queries return poor or no results:",
    problemQueries.join(", "),
    "",
    "The catalog uses category terms like:",
    catalogTerms.slice(0, 40).join(", "),
    "",
    "Propose up to 8 high-value synonym rules as a JSON array. Each item:",
    '{"query": the shopper query, "kind": "equivalent" | "oneway", "terms": comma-separated terms, "mapsTo": target term (oneway only, else omit), "rationale": one short sentence}',
    "Prefer one-way rules mapping shopper vocabulary onto catalog vocabulary. Output only the JSON array.",
  ].join("\n");
  return { system, user };
}
