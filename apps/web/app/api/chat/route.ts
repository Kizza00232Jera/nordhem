import { type ChatMessage, runChatTurn } from "../../../lib/chat/agent";
import { resolveChatConfig } from "../../../lib/chat/config";
import { chatEnabled } from "../../../lib/chat/enabled";
import { openAiCompatibleClient } from "../../../lib/chat/provider";
import { runCatalogSearch } from "../../../lib/chat/run-search";

/** Status probe: the widget asks whether the assistant is available (configured
 * AND full mode), so it can hide itself in lite mode without a server round-trip
 * on every page render. */
export async function GET() {
  return Response.json({ enabled: await chatEnabled() });
}

/**
 * Step 11c: the shopping chatbot turn. Provider-agnostic (resolveChatConfig) and
 * gated off when no key is configured, so the storefront runs fine without it and
 * no credits are ever spent unprompted. The model may only call search_products
 * over our catalog — it never ranks and never sits in the search hot path.
 */

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
  const config = resolveChatConfig(process.env);
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
    const client = openAiCompatibleClient(config);
    const result = await runChatTurn({ client, runSearch: runCatalogSearch, messages });
    return Response.json({ reply: result.reply });
  } catch {
    return Response.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }
}
