import { type ChatMessage, runChatTurn } from "../../../lib/chat/agent";
import { chatEnabled, getChatConfig } from "../../../lib/chat/enabled";
import { openAiCompatibleClient } from "../../../lib/chat/provider";
import { runCatalogSearch } from "../../../lib/chat/run-search";
import { subscriptionChatTurn } from "../../../lib/chat/subscription";

/**
 * Step 11c: the shopping chatbot turn. Configured from the studio (DB) first,
 * env as deploy fallback; off entirely when nothing is set. The model only ever
 * searches our catalog (search_products) and never sits in the search hot path.
 * Two backends: 'api' runs the tool-use loop against any OpenAI-compatible
 * provider; 'subscription' routes through the local claude CLI (free, localhost).
 */

/** Status probe: the widget asks whether the assistant is available. */
export async function GET() {
  return Response.json({ enabled: await chatEnabled() });
}

/** Keep only well-formed user/assistant turns, most recent dozen. */
function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

export async function POST(request: Request) {
  const config = await getChatConfig();
  if (!config) {
    return Response.json({ error: "The assistant is not configured." }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const messages = sanitizeMessages((payload as { messages?: unknown })?.messages);
  if (messages.length === 0) {
    return Response.json({ error: "Send a message to start." }, { status: 400 });
  }

  try {
    if (config.mode === "subscription") {
      const reply = await subscriptionChatTurn(config.model, messages);
      return Response.json({ reply });
    }
    const client = openAiCompatibleClient(config);
    const result = await runChatTurn({ client, runSearch: runCatalogSearch, messages });
    return Response.json({ reply: result.reply });
  } catch {
    return Response.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }
}
