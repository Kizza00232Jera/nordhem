import type { ChatClient, ChatCompletion, ChatMessage } from "./agent";
import type { ChatConfig } from "./config";

/**
 * Step 11c: a minimal, dependency-free ChatClient speaking the OpenAI-compatible
 * Chat Completions wire format. Because that format is the lingua franca, the
 * same client talks to OpenAI, Anthropic's compat endpoint, Groq, OpenRouter, a
 * local server, etc. — whatever CHAT_BASE_URL points at (see config.ts / D48).
 * No SDK, so nothing to keep in lockstep; the model call is the only external.
 */

interface ApiToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

function toApiMessage(m: ChatMessage): unknown {
  if (m.role === "assistant" && m.toolCalls?.length) {
    return {
      role: "assistant",
      content: m.content || null,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  if (m.role === "tool") {
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  }
  return { role: m.role, content: m.content };
}

export function openAiCompatibleClient(config: ChatConfig): ChatClient {
  return {
    async complete(messages, tools): Promise<ChatCompletion> {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: messages.map(toApiMessage),
          ...(tools.length ? { tools, tool_choice: "auto" } : {}),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`chat provider responded ${res.status}: ${detail.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: ApiToolCall[] } }[];
      };
      const msg = data.choices?.[0]?.message ?? {};
      const toolCalls = (msg.tool_calls ?? []).map((tc) => ({
        id: tc.id ?? "",
        name: tc.function?.name ?? "",
        arguments: tc.function?.arguments ?? "{}",
      }));
      return { content: msg.content ?? "", toolCalls };
    },
  };
}
