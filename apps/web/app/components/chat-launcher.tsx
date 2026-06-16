import { chatConfigured } from "../../lib/chat/enabled";
import { ChatWidget } from "./chat-widget";

/**
 * Server gate for the chatbot. Renders nothing (no client JS) unless a provider
 * key is configured, so an unconfigured storefront ships zero chatbot weight.
 * The finer "full mode only" check happens inside the widget (GET /api/chat), to
 * avoid a search-service health probe on every page render.
 */
export function ChatLauncher() {
  if (!chatConfigured()) return null;
  return <ChatWidget />;
}
