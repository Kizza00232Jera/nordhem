import { searchServiceHealthy } from "../search-source";
import { resolveChatConfig } from "./config";

/** True when a provider key + model are configured (env), regardless of mode. */
export function chatConfigured(): boolean {
  return resolveChatConfig(process.env) !== null;
}

/**
 * The full gate for showing the chatbot: configured AND in full mode (the search
 * service is reachable). The assistant searches the live catalog, so it is
 * hidden in lite mode rather than offered with a degraded tool.
 */
export async function chatEnabled(): Promise<boolean> {
  if (!chatConfigured()) return false;
  return searchServiceHealthy();
}
