"use client";

import { useEffect, useState } from "react";
import { evalRankingAction, type EvalMetrics } from "../actions/tune";

// The graduated default (mirrors DEFAULT_RANKING in services/search). The
// sliders seed from this; "Reset to default" returns here.
const DEFAULT_CONFIG = {
  fields: { name: 3, productClass: 2, description: 1 },
  fuzziness: "AUTO" as string | undefined,
  fuzzyPrefixLength: 2,
  minimumShouldMatch: "",
  phraseBoost: 4,
  popularityWeight: 0,
};

type Config = typeof DEFAULT_CONFIG;

function toPayload(c: Config) {
  return {
    fields: c.fields,
    fuzziness: c.fuzziness, // undefined turns fuzziness off
    fuzzyPrefixLength: c.fuzzyPrefixLength,
    minimumShouldMatch: c.minimumShouldMatch.trim() || undefined,
    phraseBoost: c.phraseBoost,
    popularityWeight: c.popularityWeight,
  };
}

const f4 = (n: number) => n.toFixed(4);
const pct = (n: number) => (n * 100).toFixed(1) + "%";

export function TuneControls() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [reference, setReference] = useState<EvalMetrics | null>(null);
  const [result, setResult] = useState<EvalMetrics | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Score the default once on load, on the same sample, as the delta baseline.
  useEffect(() => {
    let live = true;
    evalRankingAction(toPayload(DEFAULT_CONFIG)).then((r) => {
      if (live && "ndcg" in r) setReference(r);
    });
    return () => {
      live = false;
    };
  }, []);

  async function run() {
    setPending(true);
    setError(null);
    const r = await evalRankingAction(toPayload(config));
    setPending(false);
    if ("error" in r) setError(r.error);
    else setResult(r);
  }

  const setField = (k: keyof Config["fields"], v: number) =>
    setConfig((c) => ({ ...c, fields: { ...c.fields, [k]: v } }));

  const delta = (cur: number, ref: number | undefined) =>
    ref === undefined ? null : cur - ref;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <Slider label="Name boost" min={0} max={10} step={1} value={config.fields.name} onChange={(v) => setField("name", v)} />
        <Slider label="Class boost" min={0} max={10} step={1} value={config.fields.productClass} onChange={(v) => setField("productClass", v)} />
        <Slider label="Description boost" min={0} max={10} step={1} value={config.fields.description} onChange={(v) => setField("description", v)} />
        <Slider label="Fuzzy prefix length (0 = off, higher = stricter)" min={0} max={5} step={1} value={config.fuzzyPrefixLength} onChange={(v) => setConfig((c) => ({ ...c, fuzzyPrefixLength: v }))} />
        <Slider label="Phrase boost (words appearing together)" min={0} max={20} step={1} value={config.phraseBoost} onChange={(v) => setConfig((c) => ({ ...c, phraseBoost: v }))} />
        <Slider label="Popularity weight (review count)" min={0} max={5} step={0.5} value={config.popularityWeight} onChange={(v) => setConfig((c) => ({ ...c, popularityWeight: v }))} />

        <label className="flex items-center gap-2.5 text-[14px]">
          <input
            type="checkbox"
            checked={config.fuzziness !== undefined}
            onChange={(e) => setConfig((c) => ({ ...c, fuzziness: e.target.checked ? "AUTO" : undefined }))}
            className="size-4 accent-pine"
          />
          Typo tolerance (fuzziness AUTO)
        </label>

        <label className="block text-[14px]">
          <span className="mb-1 block text-ink-muted">Minimum should match (e.g. 2&lt;75%, blank = off)</span>
          <input
            type="text"
            value={config.minimumShouldMatch}
            onChange={(e) => setConfig((c) => ({ ...c, minimumShouldMatch: e.target.value }))}
            placeholder="blank"
            className="h-9 w-40 rounded-xs border border-line bg-card px-2.5 text-[14px]"
          />
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="rounded-xs bg-pine px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
          >
            {pending ? "Scoring on train sample…" : "Run on train sample"}
          </button>
          <button
            type="button"
            onClick={() => setConfig(DEFAULT_CONFIG)}
            className="rounded-xs border border-line px-5 py-2.5 text-[14px] font-medium hover:border-ink"
          >
            Reset to default
          </button>
        </div>
        {error && <p role="alert" className="text-[14px] text-error">{error}</p>}
      </div>

      <aside className="h-fit rounded-md border border-line bg-card p-5">
        <h2 className="text-[15px] font-semibold">Result</h2>
        <p className="mt-1 text-[12px] text-ink-muted">
          On a {result?.queryCount ?? reference?.queryCount ?? 120}-query train sample. Delta is versus the graduated default on the same sample.
        </p>
        {result ? (
          <dl className="mt-4 space-y-3">
            <Metric label="nDCG@10" value={f4(result.ndcg)} delta={delta(result.ndcg, reference?.ndcg)} fmt={f4} />
            <Metric label="MRR" value={f4(result.mrr)} delta={delta(result.mrr, reference?.mrr)} fmt={f4} />
            <Metric label="recall@100" value={pct(result.recall)} delta={delta(result.recall, reference?.recall)} fmt={(n) => (n * 100).toFixed(1) + " pts"} />
          </dl>
        ) : (
          <p className="mt-4 text-[14px] text-ink-muted">
            {reference ? "Adjust the sliders and run." : "Loading the default reference…"}
          </p>
        )}
        {reference && (
          <p className="mt-4 border-t border-line pt-3 text-[12px] text-ink-muted">
            Default reference: nDCG {f4(reference.ndcg)}, MRR {f4(reference.mrr)}, recall {pct(reference.recall)}.
          </p>
        )}
      </aside>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-[14px]">
      <span className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="tnum font-semibold">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-pine"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  delta,
  fmt,
}: {
  label: string;
  value: string;
  delta: number | null;
  fmt: (n: number) => string;
}) {
  const tone = delta == null ? "" : delta > 0.0005 ? "text-pine" : delta < -0.0005 ? "text-error" : "text-ink-muted";
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="tnum text-[16px] font-semibold">
        {value}
        {delta != null && (
          <span className={`ml-2 text-[12px] font-normal ${tone}`}>
            ({delta > 0 ? "+" : ""}{fmt(delta)})
          </span>
        )}
      </dd>
    </div>
  );
}
