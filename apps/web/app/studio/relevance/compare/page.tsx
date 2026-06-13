import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun } from "../../../../lib/eval-repo";

interface Props {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export const metadata: Metadata = { title: "Compare runs" };

const f4 = (n: number) => n.toFixed(4);
const f3 = (n: number) => n.toFixed(3);
const signed = (n: number) => (n > 0 ? "+" : "") + n.toFixed(3);

function Delta({ a, b, fmt }: { a: number; b: number; fmt: (n: number) => string }) {
  const d = b - a;
  const tone = d > 0.0005 ? "text-pine" : d < -0.0005 ? "text-error" : "text-ink-muted";
  return (
    <span className="tnum">
      {fmt(a)} <span className="text-ink-muted">to</span> {fmt(b)}{" "}
      <span className={tone}>({d > 0 ? "+" : ""}{fmt(d)})</span>
    </span>
  );
}

export default async function CompareRunsPage({ searchParams }: Props) {
  const { a, b } = await searchParams;
  if (!a || !b) notFound();
  const [runA, runB] = await Promise.all([getRun(a), getRun(b)]);
  if (!runA || !runB) notFound();

  // Pair the two runs' per-query nDCG and rank by who moved most.
  const aById = new Map(runA.scores.map((s) => [s.queryId, s]));
  const movers = runB.scores
    .map((s) => {
      const before = aById.get(s.queryId);
      return {
        queryId: s.queryId,
        query: s.query,
        ndcgA: before?.ndcg ?? 0,
        ndcgB: s.ndcg,
        delta: s.ndcg - (before?.ndcg ?? 0),
      };
    })
    .filter((m) => Math.abs(m.delta) > 0.0005)
    .sort((x, y) => y.delta - x.delta);

  const gained = movers.filter((m) => m.delta > 0);
  const lost = [...movers].filter((m) => m.delta < 0).reverse();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / compare
      </nav>
      <h1 className="mt-2 font-display text-4xl font-light">Compare runs</h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        <b className="text-ink">{runA.label}</b> to <b className="text-ink">{runB.label}</b>
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-card p-5">
          <div className="text-[12px] uppercase tracking-wide text-ink-muted">nDCG@10</div>
          <div className="mt-1 text-[15px]"><Delta a={runA.ndcg} b={runB.ndcg} fmt={f4} /></div>
        </div>
        <div className="rounded-md border border-line bg-card p-5">
          <div className="text-[12px] uppercase tracking-wide text-ink-muted">MRR</div>
          <div className="mt-1 text-[15px]"><Delta a={runA.mrr} b={runB.mrr} fmt={f4} /></div>
        </div>
        <div className="rounded-md border border-line bg-card p-5">
          <div className="text-[12px] uppercase tracking-wide text-ink-muted">recall@100</div>
          <div className="mt-1 text-[15px]"><Delta a={runA.recall} b={runB.recall} fmt={f4} /></div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Movers title="Most improved" rows={gained.slice(0, 20)} />
        <Movers title="Most regressed" rows={lost.slice(0, 20)} />
      </div>
      {movers.length === 0 && (
        <p className="mt-8 text-[14px] text-ink-muted">
          No per-query nDCG changed between these two runs.
        </p>
      )}
    </main>
  );
}

function Movers({
  title,
  rows,
}: {
  title: string;
  rows: { queryId: number; query: string; ndcgA: number; ndcgB: number; delta: number }[];
}) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-muted">None.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-md border border-line">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-linen text-left">
                <th className="px-4 py-2 font-semibold">Query</th>
                <th className="px-4 py-2 text-right font-semibold">nDCG@10</th>
                <th className="px-4 py-2 text-right font-semibold">&Delta;</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.queryId} className="border-t border-line">
                  <td className="px-4 py-2">{m.query}</td>
                  <td className="tnum px-4 py-2 text-right text-ink-muted">
                    {f3(m.ndcgA)} to {f3(m.ndcgB)}
                  </td>
                  <td
                    className={`tnum px-4 py-2 text-right font-semibold ${m.delta > 0 ? "text-pine" : "text-error"}`}
                  >
                    {signed(m.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
