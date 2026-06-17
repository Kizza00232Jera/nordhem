import { db } from "../db";
import { searchServiceHealthy } from "../search-source";
import { type ResolvedChatConfig, resolveConfigFrom } from "./config";
import { getChatSettings } from "./settings-repo";
import { tutorServerHealthy } from "./subscription";

/** The active chatbot config: studio settings (DB) first, env as deploy fallback.
 * Defensive: a settings read failure must never 500 a page (this runs in the
 * root layout), so on error we fall back to env alone. */
export async function getChatConfig(): Promise<ResolvedChatConfig | null> {
  try {
    const settings = await getChatSettings(db());
    return resolveConfigFrom(settings, process.env);
  } catch {
    return resolveConfigFrom(null, process.env);
  }
}

/**
 * Whether to show the chatbot: it must be configured AND its backend reachable.
 * API mode needs the search service (the tool searches the live catalog);
 * subscription mode needs the local tutor server (the `claude` CLI bridge).
 */
export async function chatEnabled(): Promise<boolean> {
  const cfg = await getChatConfig();
  if (!cfg) return false;
  if (cfg.mode === "subscription") return tutorServerHealthy();
  return searchServiceHealthy();
}
