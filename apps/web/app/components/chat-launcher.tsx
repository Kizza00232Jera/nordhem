import { getChatConfig } from "../../lib/chat/enabled";
import { ChatWidget } from "./chat-widget";

/**
 * Server gate for the chatbot. Renders nothing (no client JS) unless the
 * assistant is configured (studio settings or env). The finer "is the backend
 * reachable" check happens inside the widget (GET /api/chat).
 */
export async function ChatLauncher() {
  const cfg = await getChatConfig();
  if (!cfg) return null;
  return <ChatWidget />;
}
