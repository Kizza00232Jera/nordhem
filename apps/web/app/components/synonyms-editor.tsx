"use client";

import { useState, useTransition } from "react";
import {
  applySynonymsAction,
  createSynonymAction,
  deleteSynonymAction,
  toggleSynonymAction,
} from "../actions/synonyms";
import { validateSynonymRule, type SynonymKind } from "../../lib/synonyms-rules";
import type { SynonymRow } from "../../lib/synonyms-repo";

const SOURCE_LABEL: Record<string, string> = {
  seed: "seed",
  "catalog-mined": "catalog",
  manual: "manual",
};

function Chip({ children, tone = "term" }: { children: React.ReactNode; tone?: "term" | "source" }) {
  const cls =
    tone === "source"
      ? "bg-paper text-ink-muted border-line"
      : "bg-linen text-ink border-line";
  return (
    <span className={`inline-block rounded-xs border px-2 py-0.5 text-[12.5px] ${cls}`}>{children}</span>
  );
}

function Terms({ row }: { row: SynonymRow }) {
  const left = row.terms.split(",").map((t) => t.trim()).filter(Boolean);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {left.map((t, i) => (
        <Chip key={i}>{t}</Chip>
      ))}
      {row.kind === "oneway" && row.mapsTo && (
        <>
          <span className="text-ink-muted">&rarr;</span>
          <Chip>{row.mapsTo}</Chip>
        </>
      )}
    </span>
  );
}

export function SynonymsEditor({ rules }: { rules: SynonymRow[] }) {
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [apply, setApply] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const q = filter.trim().toLowerCase();
  const shown = q
    ? rules.filter((r) => (r.terms + " " + (r.mapsTo ?? "")).toLowerCase().includes(q))
    : rules;

  function onApply() {
    setApply(null);
    startTransition(async () => {
      const res = await applySynonymsAction();
      setApply(
        res.ok
          ? { tone: "ok", text: `Applied ${res.applied} rules to the live search (no reindex).` }
          : { tone: "err", text: res.error },
      );
    });
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter rules…"
          aria-label="Filter synonym rules"
          className="h-9 w-64 rounded-xs border border-line bg-card px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-pine"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={pending}
            className="rounded-xs border border-line px-4 py-2 text-[14px] font-medium hover:border-ink disabled:opacity-50"
          >
            {pending ? "Applying…" : "Apply to search"}
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-xs bg-pine px-4 py-2 text-[14px] font-semibold text-white hover:bg-pine-deep"
          >
            Add rule
          </button>
        </div>
      </div>

      {apply && (
        <p className={`mt-3 text-[13px] ${apply.tone === "ok" ? "text-pine" : "text-error"}`}>{apply.text}</p>
      )}
      <p className="mt-2 text-[12.5px] text-ink-muted">
        Editing a rule saves it to the database. <b>Apply to search</b> hot-reloads the rules into the live
        index analyzer with no reindex (synonyms are matched at query time).
      </p>

      <div className="mt-5 overflow-x-auto rounded-md border border-line">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-linen text-left">
              <th className="px-4 py-2.5 font-semibold">Type</th>
              <th className="px-4 py-2.5 font-semibold">Terms</th>
              <th className="px-4 py-2.5 font-semibold">Source</th>
              <th className="px-4 py-2.5 font-semibold">State</th>
              <th className="px-4 py-2.5 font-semibold text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  {rules.length === 0
                    ? "No synonym rules yet. Add one, or seed them with pnpm -F @nordhem/search seed-synonyms."
                    : "No rules match that filter."}
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr key={row.id} className="border-t border-line align-top hover:bg-paper">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                    {row.kind === "equivalent" ? "⇄ equivalent" : "→ one-way"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Terms row={row} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Chip tone="source">{SOURCE_LABEL[row.source] ?? row.source}</Chip>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startTransition(() => toggleSynonymAction(row.id, !row.enabled))}
                      aria-pressed={row.enabled}
                      className={`rounded-xs border px-2.5 py-1 text-[12.5px] font-medium disabled:opacity-50 ${
                        row.enabled
                          ? "border-pine bg-pine text-white"
                          : "border-line bg-card text-ink-muted"
                      }`}
                    >
                      {row.enabled ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Delete this rule (${row.terms})?`)) {
                          startTransition(() => deleteSynonymAction(row.id));
                        }
                      }}
                      className="text-[13px] text-ink-muted hover:text-error disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding && <AddRuleDrawer onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddRuleDrawer({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<SynonymKind>("equivalent");
  const [terms, setTerms] = useState("");
  const [mapsTo, setMapsTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const check = validateSynonymRule({ kind, terms, mapsTo });
  const canSave = terms.trim().length > 0 && check.ok;

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await createSynonymAction({ kind, terms, mapsTo });
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Add synonym rule">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div className="relative h-full w-[min(440px,100vw)] overflow-y-auto bg-card p-6 shadow-float">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-light">Add a synonym rule</h2>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            Close
          </button>
        </div>

        <div className="mt-6">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Type</span>
          <div className="inline-flex rounded-xs border border-line p-1 text-[13px]">
            {(["equivalent", "oneway"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-xs px-3 py-1.5 ${kind === k ? "bg-pine font-semibold text-white" : "text-ink-muted hover:text-ink"}`}
              >
                {k === "equivalent" ? "⇄ Equivalent" : "→ One-way"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-muted">
            {kind === "equivalent"
              ? "All terms mean the same thing and match each other (sofa, couch, settee)."
              : "The terms on the left map to the target, but not the other way (hassock → ottoman)."}
          </p>
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">
            {kind === "equivalent" ? "Terms (comma-separated)" : "Search terms (comma-separated)"}
          </span>
          <input
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder={kind === "equivalent" ? "sofa, couch, settee" : "couch, settee"}
            className="h-10 w-full rounded-xs border border-line bg-card px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-pine"
          />
        </label>

        {kind === "oneway" && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Maps to</span>
            <input
              value={mapsTo}
              onChange={(e) => setMapsTo(e.target.value)}
              placeholder="sofa"
              className="h-10 w-full rounded-xs border border-line bg-card px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-pine"
            />
          </label>
        )}

        {check.warning && terms.trim() && (
          <p className="mt-4 rounded-xs border border-amber/40 bg-amber/10 px-3 py-2 text-[12.5px] text-ink">
            {check.warning}
          </p>
        )}
        {!check.ok && terms.trim() && (
          <p className="mt-4 text-[12.5px] text-error">{check.error}</p>
        )}
        {error && <p className="mt-4 text-[12.5px] text-error">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || pending}
            className="rounded-xs bg-pine px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save rule"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xs border border-line px-5 py-2.5 text-[14px] font-medium hover:border-ink"
          >
            Cancel
          </button>
        </div>
        <p className="mt-3 text-[12px] text-ink-muted">Saved rules are enabled, but only reach live search once you click Apply to search.</p>
      </div>
    </div>
  );
}
