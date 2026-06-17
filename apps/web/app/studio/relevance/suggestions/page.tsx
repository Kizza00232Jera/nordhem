import type { Metadata } from "next";
import Link from "next/link";
import { GenerateSuggestionsButton } from "../../../components/generate-suggestions-button";
import { SuggestionsQueue } from "../../../components/suggestions-queue";
import { zeroResultQueries } from "../../../../lib/analytics-repo";
import { db } from "../../../../lib/db";
import { listSuggestions, suggestionCounts } from "../../../../lib/suggestions-repo";

export const metadata: Metadata = { title: "Assistant suggestions" };

export default async function SuggestionsPage() {
  const [pending, counts, candidates] = await Promise.all([
    listSuggestions(db(), "pending"),
    suggestionCounts(db()),
    zeroResultQueries(db(), 8, "all"),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / Assistant
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Assistant suggestions</h1>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        The editor assistant analyses the worst and zero-result queries and proposes synonyms. Every
        proposal lands here for a human to approve or reject &mdash; an approval creates a synonym rule
        you still have to Apply, so an AI never ships a change on its own. Suggestions come from a Claude
        session (on the subscription, no API cost) or the heuristic generator.
      </p>
      <p className="mt-2 text-[13px] text-ink-muted">
        {counts.pending ?? 0} pending &middot; {counts.approved ?? 0} approved &middot;{" "}
        {counts.rejected ?? 0} rejected
      </p>

      {candidates.length > 0 && (
        <section className="mt-6 rounded-md border border-line bg-card p-4">
          <h2 className="text-[13px] font-semibold text-ink-muted">Queries worth fixing (zero results)</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {candidates.map((c) => (
              <span key={c.query} className="rounded-xs bg-linen px-2.5 py-1 text-[13px]">
                {c.query} <span className="text-ink-muted">&times;{c.searches}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <GenerateSuggestionsButton />
      <SuggestionsQueue suggestions={pending} />
    </main>
  );
}
