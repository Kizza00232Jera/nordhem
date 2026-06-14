import type { Metadata } from "next";
import Link from "next/link";
import { listRuns } from "../../../lib/eval-repo";

export const metadata: Metadata = { title: "Relevance lab" };

const dateFmt = new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" });
const f4 = (n: number) => n.toFixed(4);
const pct = (n: number) => (n * 100).toFixed(1) + "%";

export default async function RelevanceLabPage() {
  const runs = await listRuns();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> / Relevance lab
      </nav>
      <div className="mt-2 flex items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-light">Relevance lab</h1>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/studio/relevance/synonyms"
            className="rounded-xs border border-line px-4 py-2 text-[14px] font-medium hover:border-ink"
          >
            Synonyms
          </Link>
          <Link
            href="/studio/relevance/curations"
            className="rounded-xs border border-line px-4 py-2 text-[14px] font-medium hover:border-ink"
          >
            Curations
          </Link>
          <Link
            href="/studio/relevance/history"
            className="rounded-xs border border-line px-4 py-2 text-[14px] font-medium hover:border-ink"
          >
            History
          </Link>
          <Link
            href="/studio/relevance/explain"
            className="rounded-xs border border-line px-4 py-2 text-[14px] font-medium hover:border-ink"
          >
            Explain a score
          </Link>
          <Link
            href="/studio/relevance/tune"
            className="rounded-xs bg-pine px-4 py-2 text-[14px] font-semibold text-white hover:bg-pine-deep"
          >
            Tune ranking
          </Link>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        Each run scores the search config against all 480 WANDS queries using
        233k human judgments. nDCG@10 measures ranking quality, MRR how high the
        first relevant result sits, recall@100 how many relevant products are
        found at all. Produce a run with{" "}
        <code className="rounded bg-linen px-1.5 py-0.5 text-[12px]">pnpm -F @nordhem/search run-eval &quot;label&quot;</code>.
      </p>

      {runs.length === 0 ? (
        <div className="mt-10 rounded-md border border-dashed border-line p-10 text-center text-[14px] text-ink-muted">
          No runs yet. Run <code className="rounded bg-linen px-1.5 py-0.5">pnpm -F @nordhem/search run-eval</code> to score the current config.
        </div>
      ) : (
        <>
          <div className="mt-8 overflow-x-auto rounded-md border border-line">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-linen text-left">
                  <th className="px-4 py-2.5 font-semibold">Run</th>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Queries</th>
                  <th className="px-4 py-2.5 text-right font-semibold">nDCG@10</th>
                  <th className="px-4 py-2.5 text-right font-semibold">MRR</th>
                  <th className="px-4 py-2.5 text-right font-semibold">recall@100</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-line hover:bg-paper">
                    <td className="px-4 py-2.5">
                      <Link href={`/studio/relevance/${run.id}`} className="font-medium text-pine hover:underline">
                        {run.label}
                      </Link>
                      <span className="ml-2 text-[12px] text-ink-muted">{run.indexName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{dateFmt.format(run.createdAt)}</td>
                    <td className="tnum px-4 py-2.5 text-right">{run.queryCount}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold">{f4(run.ndcg)}</td>
                    <td className="tnum px-4 py-2.5 text-right">{f4(run.mrr)}</td>
                    <td className="tnum px-4 py-2.5 text-right">{pct(run.recall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {runs.length >= 2 && (
            <p className="mt-4 text-[13px] text-ink-muted">
              Compare the two newest runs side by side:{" "}
              <Link
                href={`/studio/relevance/compare?a=${runs[1]!.id}&b=${runs[0]!.id}`}
                className="text-pine hover:underline"
              >
                {runs[1]!.label} vs {runs[0]!.label}
              </Link>
            </p>
          )}
        </>
      )}
    </main>
  );
}
