"use client";

import { useState, useTransition } from "react";
import { saveChatSettingsAction } from "../actions/chat-settings";

interface InitialSettings {
  mode: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKeySet: boolean;
}

const field = "h-9 w-full rounded-xs border border-line bg-card px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-pine";
const label = "mb-1 block text-[13px] text-ink-muted";

export function ChatSettingsForm({ initial }: { initial: InitialSettings }) {
  const [mode, setMode] = useState(initial.mode);
  const [provider, setProvider] = useState(initial.provider);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await saveChatSettingsAction({ mode, provider, baseUrl, model, apiKey });
      setStatus(res.ok ? res.message : res.error);
      if (res.ok) setApiKey("");
    });
  }

  return (
    <div className="mt-6 max-w-xl space-y-4">
      <div>
        <span className={label}>Mode</span>
        <div className="flex gap-2">
          {[
            ["off", "Off"],
            ["api", "API key"],
            ["subscription", "Subscription (local)"],
          ].map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-xs border px-3 py-1.5 text-[13px] ${
                mode === value ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {mode === "api" && (
        <>
          <p className="rounded-xs border border-line bg-card px-3 py-2 text-[13px] text-ink-muted">
            Works anywhere (localhost and deployed) with any OpenAI-compatible provider. Uses that
            provider&rsquo;s credits.
          </p>
          <label className="block">
            <span className={label}>Provider label</span>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="openai" className={field} />
          </label>
          <label className="block">
            <span className={label}>Base URL</span>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className={field} />
          </label>
          <label className="block">
            <span className={label}>Model</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" className={field} />
          </label>
          <label className="block">
            <span className={label}>API key {initial.apiKeySet && <span>(a key is saved; leave blank to keep it)</span>}</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={initial.apiKeySet ? "•••••••• (unchanged)" : "paste your key"}
              className={field}
            />
          </label>
        </>
      )}

      {mode === "subscription" && (
        <>
          <p className="rounded-xs border border-amber/40 bg-amber/10 px-3 py-2 text-[13px] text-ink">
            Localhost only, free: routes through your local Claude CLI via the tutor server. Start it with{" "}
            <code className="rounded bg-linen px-1 py-0.5">pnpm tutor</code>. A deployed site cannot use this.
          </p>
          <label className="block">
            <span className={label}>Model</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="sonnet" className={field} />
            <span className="mt-1 block text-[12px] text-ink-muted">opus, sonnet, or haiku</span>
          </label>
        </>
      )}

      {mode === "off" && (
        <p className="text-[13px] text-ink-muted">The shop assistant is hidden from the storefront.</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-9 rounded-xs bg-pine px-4 text-[14px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {status && <span className="text-[13px] text-pine">{status}</span>}
      </div>
    </div>
  );
}
