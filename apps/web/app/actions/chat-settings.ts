"use server";

import { logChange } from "../../lib/change-log-repo";
import type { ChatSettings } from "../../lib/chat/config";
import { getChatSettings, saveChatSettings } from "../../lib/chat/settings-repo";
import { db } from "../../lib/db";

export type SaveChatResult = { ok: true; message: string } | { ok: false; error: string };

const MODES = new Set(["off", "api", "subscription"]);

/**
 * Save the chatbot config from the studio. The key field can be left blank to
 * KEEP the existing key (so editing the model/provider does not wipe it), which
 * also means the stored key never has to be sent back to the browser.
 */
export async function saveChatSettingsAction(input: ChatSettings): Promise<SaveChatResult> {
  const mode = MODES.has(input.mode) ? input.mode : "off";
  const current = await getChatSettings(db());
  const apiKey = input.apiKey.trim() || current.apiKey; // blank = keep existing

  if (mode === "api" && (!apiKey || !input.model.trim())) {
    return { ok: false, error: "API mode needs both a model and an API key." };
  }
  if (mode === "subscription" && !input.model.trim()) {
    return { ok: false, error: "Pick a subscription model (opus, sonnet or haiku)." };
  }

  await saveChatSettings(db(), {
    mode,
    provider: input.provider.trim() || "openai-compatible",
    baseUrl: input.baseUrl.trim() || "https://api.openai.com/v1",
    model: input.model.trim(),
    apiKey,
  });
  await logChange("chat", "update", `Chatbot set to ${mode} mode`, { provider: input.provider, model: input.model });

  const note =
    mode === "subscription"
      ? "Saved. Subscription mode needs the local tutor server running (pnpm tutor)."
      : mode === "api"
        ? "Saved. The assistant is live when the search service is up."
        : "Saved. The assistant is off.";
  return { ok: true, message: note };
}
