import { chatSettings, type Db, eq } from "@nordhem/db";
import type { ChatSettings } from "./config";

/** The chatbot config lives in one row (id=1), edited from the studio Settings
 * page instead of .env, so anyone running the project can configure it from the
 * UI. */
const SINGLETON_ID = 1;

const DEFAULTS: ChatSettings = {
  mode: "off",
  provider: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  apiKey: "",
};

export async function getChatSettings(db: Db): Promise<ChatSettings> {
  const [row] = await db.select().from(chatSettings).where(eq(chatSettings.id, SINGLETON_ID));
  if (!row) return { ...DEFAULTS };
  return {
    mode: row.mode,
    provider: row.provider,
    baseUrl: row.baseUrl,
    model: row.model,
    apiKey: row.apiKey,
  };
}

export async function saveChatSettings(db: Db, input: ChatSettings): Promise<void> {
  const values = { id: SINGLETON_ID, ...input, updatedAt: new Date() };
  await db
    .insert(chatSettings)
    .values(values)
    .onConflictDoUpdate({ target: chatSettings.id, set: { ...input, updatedAt: new Date() } });
}
