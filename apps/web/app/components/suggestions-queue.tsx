"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SuggestionRow } from "../../lib/suggestions-repo";
import { approveSuggestionAction, rejectSuggestionAction } from "../actions/suggestions";

function ruleText(s: SuggestionRow): string {
  return s.kind === "oneway" ? `${s.terms} → ${s.mapsTo ?? ""}` : s.terms;
}

export function SuggestionsQueue({ suggestions }: { suggestions: SuggestionRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(id: number, kind: "approve" | "reject") {
    setMessage(null);
    setBusyId(id);
    startTransition(async () => {
      const res =
        kind === "approve"
          ? await approveSuggestionAction(id)
          : await rejectSuggestionAction(id);
      setMessage(res.ok ? res.message : res.error);
      setBusyId(null);
      if (res.ok) router.refresh();
    });
  }

  if (suggestions.length === 0) {
    return (
      <div className="mt-8 rounded-md border border-dashed border-line p-10 text-center text-[14px] text-ink-muted">
        No pending suggestions. Generate some with{" "}
        <code className="rounded bg-linen px-1.5 py-0.5">pnpm -F @nordhem/search suggest-synonyms</code>, or
        have a Claude session analyse the worst queries and add them to the queue.
      </div>
    );
  }

  return (
    <>
      {message && <p className="mt-3 text-[13px] text-pine">{message}</p>}
      <ul className="mt-6 space-y-3">
        {suggestions.map((s) => (
          <li key={s.id} className="rounded-md border border-line bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-xs bg-linen px-2 py-0.5 text-[12px] font-medium">{s.kind}</span>
                  <span className="font-display text-[16px]">{ruleText(s)}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-ink-muted">{s.rationale}</p>
                <p className="mt-1 text-[12px] text-ink-muted">
                  for query <span className="font-medium text-ink">{s.query}</span> &middot; {s.source}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => decide(s.id, "approve")}
                  disabled={pending && busyId === s.id}
                  className="h-8 rounded-xs bg-pine px-4 text-[13px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(s.id, "reject")}
                  disabled={pending && busyId === s.id}
                  className="h-8 rounded-xs border border-line px-4 text-[13px] font-medium hover:border-ink disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
