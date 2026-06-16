import { describe, expect, it } from "vitest";
import { resolveChatConfig } from "../lib/chat/config";

// Step 11c: the chatbot is provider-agnostic and OFF by default. resolveChatConfig
// reads env and returns null unless a key + model are present, so the storefront
// is fully functional with no chatbot and no secrets. Any OpenAI-compatible
// provider works by pointing CHAT_BASE_URL at it (OpenAI, Anthropic's compat
// endpoint, Groq, a local server, ...).
describe("resolveChatConfig", () => {
  it("is null when the key or model is missing", () => {
    expect(resolveChatConfig({})).toBeNull();
    expect(resolveChatConfig({ CHAT_API_KEY: "sk-x" })).toBeNull();
    expect(resolveChatConfig({ CHAT_MODEL: "gpt-4o-mini" })).toBeNull();
    expect(resolveChatConfig({ CHAT_API_KEY: "  ", CHAT_MODEL: "x" })).toBeNull();
  });

  it("defaults base URL and provider when only key + model are set", () => {
    expect(resolveChatConfig({ CHAT_API_KEY: "sk-x", CHAT_MODEL: "gpt-4o-mini" })).toEqual({
      apiKey: "sk-x",
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
      provider: "openai-compatible",
    });
  });

  it("accepts any provider via base URL, trimming a trailing slash", () => {
    expect(
      resolveChatConfig({
        CHAT_API_KEY: "sk-ant",
        CHAT_MODEL: "claude-haiku-4-5",
        CHAT_BASE_URL: "https://api.anthropic.com/v1/",
        CHAT_PROVIDER: "anthropic",
      }),
    ).toEqual({
      apiKey: "sk-ant",
      model: "claude-haiku-4-5",
      baseUrl: "https://api.anthropic.com/v1",
      provider: "anthropic",
    });
  });
});
