/**
 * Step 11c: the shopping chatbot is provider-agnostic and off unless configured.
 * It speaks the OpenAI-compatible Chat Completions wire format, so ANY provider
 * exposing that (OpenAI, Anthropic's compat endpoint, Groq, OpenRouter, a local
 * server, ...) works by setting CHAT_BASE_URL + CHAT_MODEL + CHAT_API_KEY. With
 * no key the feature stays hidden and the storefront needs no secrets.
 */
export interface ChatConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
}

type Env = Record<string, string | undefined>;

export function resolveChatConfig(env: Env): ChatConfig | null {
  const apiKey = env.CHAT_API_KEY?.trim();
  const model = env.CHAT_MODEL?.trim();
  if (!apiKey || !model) return null;
  const baseUrl = (env.CHAT_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const provider = env.CHAT_PROVIDER?.trim() || "openai-compatible";
  return { apiKey, baseUrl, model, provider };
}
