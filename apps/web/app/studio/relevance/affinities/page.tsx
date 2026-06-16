import type { Metadata } from "next";
import Link from "next/link";
import { affinityCounts, listAffinities } from "../../../../lib/affinity-repo";
import { ProductThumb } from "../../../components/product-thumb";

export const metadata: Metadata = { title: "Learning loop" };

type Props = { searchParams: Promise<{ source?: string }> };

const f3 = (n: number) => n.toFixed(3);

export default async function AffinitiesPage({ searchParams }: Props) {
  const { source: requested } = await searchParams;
  const source = requested === "synthetic" ? "synthetic" : "live";
  const [groups, counts] = await Promise.all([listAffinities(source), affinityCounts()]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <nav className="text-[13px] text-ink-muted">
        <Link href="/studio" className="hover:text-ink">Studio</Link> /{" "}
        <Link href="/studio/relevance" className="hover:text-ink">Relevance lab</Link> / Learning loop
      </nav>
      <div className="mt-2 flex items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-light">Learning loop</h1>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/studio/relevance/affinities?source=live"
            className={`rounded-xs border px-4 py-2 text-[14px] font-medium ${
              source === "live" ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
            }`}
          >
            Live ({counts.live ?? 0})
          </Link>
          <Link
            href="/studio/relevance/affinities?source=synthetic"
            className={`rounded-xs border px-4 py-2 text-[14px] font-medium ${
              source === "synthetic" ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
            }`}
          >
            Synthetic ({counts.synthetic ?? 0})
          </Link>
        </div>
      </div>

      <p className="mt-2 max-w-2xl text-[14px] text-ink-muted">
        What the click feedback has learned. The{" "}
        <code className="rounded bg-linen px-1.5 py-0.5 text-[12px]">aggregate-clicks</code> job reads
        logged clicks, corrects them for position bias (a deep click counts more than a shallow one),
        and normalises each query to a 0&ndash;1 affinity. At search time that becomes a capped
        additive boost, so products people actually click float up &mdash; no LLM in the hot path.
      </p>

      {source === "synthetic" && (
        <p className="mt-3 max-w-2xl rounded-xs border border-amber/40 bg-amber/10 px-4 py-2.5 text-[13px] text-ink">
          Synthetic affinities are derived from the WANDS judgments, so evaluating them against those
          same judgments is circular. They demonstrate the mechanism end to end; only the live stream
          is an honest ranking signal.
        </p>
      )}

      {groups.length === 0 ? (
        <div className="mt-10 rounded-md border border-dashed border-line p-10 text-center text-[14px] text-ink-muted">
          No {source} affinities yet. Generate some with{" "}
          <code className="rounded bg-linen px-1.5 py-0.5">pnpm -F @nordhem/search aggregate-clicks</code>
          {source === "synthetic" && (
            <> (after <code className="rounded bg-linen px-1.5 py-0.5">simulate-traffic</code>, then{" "}
            <code className="rounded bg-linen px-1.5 py-0.5">aggregate-clicks --source synthetic</code>)</>
          )}
          .
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {groups.map((group) => (
            <section key={group.query} className="rounded-md border border-line">
              <header className="flex items-baseline justify-between border-b border-line bg-linen px-4 py-2.5">
                <h2 className="font-display text-lg">{group.query}</h2>
                <span className="text-[12px] text-ink-muted">
                  {group.entries.length} product{group.entries.length === 1 ? "" : "s"}
                </span>
              </header>
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Clicks</th>
                    <th className="px-4 py-2 font-medium">Affinity</th>
                    <th className="px-4 py-2 text-right font-medium">Boost</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((e) => (
                    <tr key={e.productId} className="border-t border-line">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb src={e.imageThumbUrl} sizeClass="size-8" px={32} />
                          <span className="min-w-0 truncate">{e.name}</span>
                        </div>
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-ink-muted">{e.observations}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-linen">
                            <div className="h-full bg-pine" style={{ width: `${e.affinity * 100}%` }} />
                          </div>
                          <span className="tnum text-[12px] text-ink-muted">{f3(e.affinity)}</span>
                        </div>
                      </td>
                      <td className="tnum px-4 py-2.5 text-right font-semibold text-pine">
                        +{e.boost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
