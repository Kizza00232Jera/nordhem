import type { Metadata } from "next";
import Link from "next/link";
import { ChatSettingsForm } from "../../components/chat-settings-form";
import { getChatSettings } from "../../../lib/chat/settings-repo";
import { db } from "../../../lib/db";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const s = await getChatSettings(db());

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> / Settings
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Settings</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        Configure the shop assistant (the chatbot). It is off until you choose a mode, so the storefront
        ships with no chatbot and no cost by default. API mode works anywhere with any OpenAI-compatible
        provider; subscription mode runs free on your own machine through the local Claude CLI.
      </p>
      <p className="mt-2 max-w-2xl rounded-xs border border-line bg-card px-3 py-2 text-[12px] text-ink-muted">
        Note: the key is stored in the database as-is, which is fine for this personal demo. Protect the
        studio with an editor role before any public deploy, and use a secret manager for a real product.
      </p>

      <ChatSettingsForm
        initial={{
          mode: s.mode,
          provider: s.provider,
          baseUrl: s.baseUrl,
          model: s.model,
          apiKeySet: s.apiKey.length > 0,
        }}
      />
    </main>
  );
}
