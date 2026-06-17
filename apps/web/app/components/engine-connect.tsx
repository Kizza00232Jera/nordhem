"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { connectEngineAction, disconnectEngineAction } from "../actions/engine";

const field = "h-9 w-full rounded-xs border border-line bg-card px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-pine";

/**
 * Step 12: "bring your own engine" panel. A reader who clones the repo and runs
 * the search service behind a tunnel can paste its URL + password here to drive
 * the live site from their machine, for their session only.
 */
export function EngineConnect({ connectedUrl }: { connectedUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function connect() {
    setStatus(null);
    startTransition(async () => {
      const res = await connectEngineAction(url, token);
      setStatus(res.ok ? res.message : res.error);
      if (res.ok) {
        setUrl("");
        setToken("");
        router.refresh();
      }
    });
  }

  function disconnect() {
    setStatus(null);
    startTransition(async () => {
      const res = await disconnectEngineAction();
      setStatus(res.ok ? res.message : "error");
      router.refresh();
    });
  }

  return (
    <section className="mt-8 rounded-md border border-line bg-card p-5">
      <h2 className="font-display text-lg">Bring your own search engine</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">
        Clone the repo, run the search service, and expose it with one command:{" "}
        <code className="rounded bg-linen px-1 py-0.5 text-[12px]">pnpm -F @nordhem/search tunnel</code>. Paste
        the printed https URL and the shared password below to drive this live site from your machine. It only
        affects your own browser session.
      </p>

      {connectedUrl ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-xs bg-pine/10 px-3 py-1.5 text-[13px] text-ink">
            Connected to <span className="font-medium">{connectedUrl}</span>
          </span>
          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            className="h-8 rounded-xs border border-line px-4 text-[13px] font-medium hover:border-ink disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-4 max-w-md space-y-3">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-tunnel.trycloudflare.com" className={field} />
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="shared password" className={field} />
          <button
            type="button"
            onClick={connect}
            disabled={pending}
            className="h-9 rounded-xs bg-pine px-4 text-[14px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
          >
            {pending ? "Connecting…" : "Connect my engine"}
          </button>
        </div>
      )}

      {status && <p className="mt-3 text-[13px] text-pine">{status}</p>}
    </section>
  );
}
