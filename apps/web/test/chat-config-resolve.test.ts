import { describe, expect, it } from "vitest";
import { resolveConfigFrom, type ChatSettings } from "../lib/chat/config";

// The chatbot is configured from the studio (DB) first, with env as a deploy
// fallback. resolveConfigFrom is the pure decision: api mode (any provider key),
// subscription mode (local claude CLI, no key), or off. Tested here so the
// branching is provable without a DB.
const base: ChatSettings = {
  mode: "off",
  provider: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  apiKey: "",
};

describe("resolveConfigFrom", () => {
  it("is null when nothing is configured and no env fallback", () => {
    expect(resolveConfigFrom(null, {})).toBeNull();
    expect(resolveConfigFrom(base, {})).toBeNull();
  });

  it("uses api mode from DB settings, trimming the base URL", () => {
    const cfg = resolveConfigFrom(
      { ...base, mode: "api", provider: "groq", baseUrl: "https://api.groq.com/openai/v1/", model: "llama-3.3-70b", apiKey: "gsk_x" },
      {},
    );
    expect(cfg).toEqual({
      mode: "api",
      provider: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b",
      apiKey: "gsk_x",
    });
  });

  it("uses subscription mode with a default model", () => {
    expect(resolveConfigFrom({ ...base, mode: "subscription", model: "" }, {})).toEqual({
      mode: "subscription",
      model: "sonnet",
    });
  });

  it("falls back to env when DB mode is off or the api settings are incomplete", () => {
    const env = { CHAT_API_KEY: "sk-env", CHAT_MODEL: "gpt-4o-mini" };
    expect(resolveConfigFrom({ ...base, mode: "off" }, env)).toMatchObject({ mode: "api", apiKey: "sk-env" });
    // mode 'api' but no key -> not usable -> env fallback
    expect(resolveConfigFrom({ ...base, mode: "api", model: "x" }, env)).toMatchObject({ mode: "api", apiKey: "sk-env" });
  });
});
