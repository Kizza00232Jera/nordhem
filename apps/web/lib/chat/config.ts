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

/** The studio settings row shape (mirrors the chat_settings table). */
export interface ChatSettings {
  mode: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

/**
 * The resolved, ready-to-use config the chatbot and generator act on:
 * - api: call an OpenAI-compatible endpoint with a key (works anywhere).
 * - subscription: route through the local `claude` CLI (localhost, free, no key).
 */
export type ResolvedChatConfig =
  | { mode: "api"; provider: string; baseUrl: string; model: string; apiKey: string }
  | { mode: "subscription"; model: string };

/**
 * Decide the active config: studio settings (DB) win; env is the deploy
 * fallback. An 'api' row needs both a key and a model to count; otherwise we
 * fall through to env, so a misconfigured row never silently breaks deploy.
 */
export function resolveConfigFrom(settings: ChatSettings | null, env: Env): ResolvedChatConfig | null {
  if (settings) {
    if (settings.mode === "api" && settings.apiKey.trim() && settings.model.trim()) {
      return {
        mode: "api",
        provider: settings.provider.trim() || "openai-compatible",
        baseUrl: (settings.baseUrl.trim() || "https://api.openai.com/v1").replace(/\/+$/, ""),
        model: settings.model.trim(),
        apiKey: settings.apiKey.trim(),
      };
    }
    if (settings.mode === "subscription") {
      return { mode: "subscription", model: settings.model.trim() || "sonnet" };
    }
  }
  const envCfg = resolveChatConfig(env);
  return envCfg ? { mode: "api", ...envCfg } : null;
}
