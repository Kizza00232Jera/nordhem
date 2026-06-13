import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun } from "../../../../lib/eval-repo";

interface Props {
  params: Promise<{ runId: string }>;
}

export const metadata: Metadata = { title: "Run detail" };

const dateFmt = new Intl.DateTimeFormat("en-IE", { dateStyle: "long", timeStyle: "short" });
const f4 = (n: number) => n.toFixed(4);
const f3 = (n: number) => n.toFixed(3);
const pct = (n: number) => (n * 100).toFixed(1) + "%";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-card p-5">
      <div className="text-[12px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="tnum mt-1 font-display text-3xl font-light">{value}</div>
    </div>
  );
}

export default async function RunDetailPage({ params }: Props) {
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) notFound();

  const zeroes = run.scores.filter((s) => s.ndcg === 0).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / run
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">{run.label}</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        {run.indexName} · {dateFmt.format(run.createdAt)} · {run.queryCount} queries
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="nDCG@10" value={f4(run.ndcg)} />
        <Metric label="MRR" value={f4(run.mrr)} />
        <Metric label="recall@100" value={pct(run.recall)} />
        <Metric label="zero-score queries" value={String(zeroes)} />
      </div>

      <h2 className="mt-10 text-[15px] font-semibold">
        Per-query scores <span className="font-normal text-ink-muted">(worst first)</span>
      </h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        The {zeroes} queries scoring 0 are the shortlist for synonyms and query
        rewriting: typos, out-of-catalog asks, and long-tail brand terms.
      </p>
      <div className="mt-4 max-h-[640px] overflow-y-auto rounded-md border border-line">
        <table className="w-full border-collapse text-[13.5px]">
          <thead className="sticky top-0">
            <tr className="bg-linen text-left">
              <th className="px-4 py-2.5 font-semibold">Query</th>
              <th className="px-4 py-2.5 text-right font-semibold">nDCG@10</th>
              <th className="px-4 py-2.5 text-right font-semibold">RR</th>
              <th className="px-4 py-2.5 text-right font-semibold">recall@100</th>
            </tr>
          </thead>
          <tbody>
            {run.scores.map((s) => (
              <tr key={s.queryId} className="border-t border-line">
                <td className="px-4 py-2">
                  {s.query}
                  <span className="ml-2 text-[11px] text-ink-muted">#{s.queryId}</span>
                </td>
                <td
                  className={`tnum px-4 py-2 text-right ${s.ndcg === 0 ? "text-error" : ""}`}
                >
                  {f3(s.ndcg)}
                </td>
                <td className="tnum px-4 py-2 text-right text-ink-muted">{f3(s.rr)}</td>
                <td className="tnum px-4 py-2 text-right text-ink-muted">{pct(s.recall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
