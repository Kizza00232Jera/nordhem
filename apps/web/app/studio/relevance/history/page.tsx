import type { Metadata } from "next";
import Link from "next/link";
import { listChanges } from "../../../../lib/change-log-repo";

export const metadata: Metadata = { title: "Change history" };

const dateFmt = new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" });

const ACTION_TONE: Record<string, string> = {
  apply: "bg-pine text-white border-pine",
  delete: "bg-paper text-error border-line",
};

export default async function HistoryPage() {
  const changes = await listChanges(200);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / History
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Change history</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        Every synonym and curation change, newest first: who, when, and what. Edits are recorded as they
        happen; an <b>apply</b> entry marks when synonym rules were pushed live to the search analyzer.
      </p>

      {changes.length === 0 ? (
        <div className="mt-10 rounded-md border border-dashed border-line p-10 text-center text-[14px] text-ink-muted">
          No changes recorded yet. Edit a synonym or a curation and it will appear here.
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-linen text-left">
                <th className="px-4 py-2.5 font-semibold">When</th>
                <th className="px-4 py-2.5 font-semibold">Who</th>
                <th className="px-4 py-2.5 font-semibold">Action</th>
                <th className="px-4 py-2.5 font-semibold">What</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-paper">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">{dateFmt.format(c.createdAt)}</td>
                  <td className="px-4 py-2.5">{c.actor}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-xs border px-2 py-0.5 text-[12px] ${ACTION_TONE[c.action] ?? "bg-paper text-ink-muted border-line"}`}
                    >
                      {c.entity} · {c.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{c.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
