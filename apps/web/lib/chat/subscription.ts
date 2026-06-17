import type { ChatMessage } from "./agent";
import { runCatalogSearch } from "./run-search";
import { formatHitsForModel } from "./tools";

/**
 * Subscription mode (localhost, free): instead of a metered API key, route the
 * chatbot through the local `claude` CLI via the same tutor server the lessons
 * use (`pnpm tutor`), so it bills the Claude subscription, not API credits.
 *
 * The CLI bridge does not do agentic tool-use, so this is retrieve-then-generate
 * rather than the API path's tool-use loop: we run ONE catalog search from the
 * shopper's latest message, hand the model those real products, and ask it to
 * recommend from them. Still grounded (no invented inventory), just one search
 * per turn. Localhost only; the deployed site cannot reach the local CLI.
 */
const TUTOR_URL = process.env.TUTOR_URL ?? "http://127.0.0.1:8765";

/** Is the local tutor server (the subscription bridge) up? */
export async function tutorServerHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${TUTOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function subscriptionChatTurn(model: string, messages: ChatMessage[]): Promise<string> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const hits = lastUser ? await runCatalogSearch({ query: lastUser.content, size: 8 }).catch(() => []) : [];

  const system = [
    "You are the NORDHEM shopping assistant for a Nordic home-goods store.",
    "Recommend ONLY from the catalog results below. Never invent products, prices or stock.",
    "Be warm and concise; prices are in euros. If nothing fits, say so and suggest another search.",
    "",
    "Catalog results for the shopper's latest request:",
    formatHitsForModel(hits),
  ].join("\n");

  const res = await fetch(`${TUTOR_URL}/tutor`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`tutor server responded ${res.status}`);
  const data = (await res.json()) as { text?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return String(data.text ?? "");
}
