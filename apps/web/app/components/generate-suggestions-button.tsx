"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateSuggestionsAction } from "../actions/suggestions";

/** Runs the AI generator (uses the assistant config from Settings) and refreshes
 * the queue. Disabled-looking until it returns; surfaces the result inline. */
export function GenerateSuggestionsButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setStatus(null);
    startTransition(async () => {
      const res = await generateSuggestionsAction();
      setStatus(res.ok ? res.message : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="h-9 rounded-xs bg-pine px-4 text-[14px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
      >
        {pending ? "Asking the model…" : "Generate with AI"}
      </button>
      <span className="text-[12px] text-ink-muted">
        Uses the assistant configured in Settings (your key, or your subscription locally).
      </span>
      {status && <span className="w-full text-[13px] text-pine">{status}</span>}
    </div>
  );
}
