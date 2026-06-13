"use client";

import { useState } from "react";
import { explainAction, type ExplainNode, type ExplainOutcome } from "../actions/explain";

export function ExplainView() {
  const [query, setQuery] = useState("light chair");
  const [productId, setProductId] = useState("");
  const [scope, setScope] = useState<"all" | "shop">("shop");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<ExplainOutcome | null>(null);

  async function run() {
    setPending(true);
    setOutcome(await explainAction(query, productId, scope));
    setPending(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-[14px]">
          <span className="mb-1 block text-ink-muted">Query</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-56 rounded-xs border border-line bg-card px-2.5 text-[14px]"
          />
        </label>
        <label className="block text-[14px]">
          <span className="mb-1 block text-ink-muted">Product id</span>
          <input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="e.g. 17696"
            className="h-9 w-36 rounded-xs border border-line bg-card px-2.5 text-[14px]"
          />
        </label>
        <label className="block text-[14px]">
          <span className="mb-1 block text-ink-muted">Index</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "all" | "shop")}
            className="h-9 rounded-xs border border-line bg-card px-2.5 text-[14px]"
          >
            <option value="shop">shop</option>
            <option value="all">benchmark</option>
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="h-9 rounded-xs bg-pine px-5 text-[14px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
        >
          {pending ? "Explaining…" : "Explain"}
        </button>
      </div>

      {outcome && "error" in outcome && (
        <p role="alert" className="mt-5 text-[14px] text-error">{outcome.error}</p>
      )}
      {outcome && "explanation" in outcome && (
        <div className="mt-6 rounded-md border border-line bg-card p-5">
          <div className="mb-3 text-[14px]">
            {outcome.matched ? (
              <span className="text-pine">Matched.</span>
            ) : (
              <span className="text-error">Did not match.</span>
            )}{" "}
            Final score{" "}
            <span className="tnum font-semibold">{outcome.explanation.value.toFixed(4)}</span>
          </div>
          <ExplainTree node={outcome.explanation} depth={0} />
        </div>
      )}
    </div>
  );
}

// The score tree: each node's contribution and what produced it, indented by
// depth. Deep nodes (the BM25 term-frequency leaves) collapse by default.
function ExplainTree({ node, depth }: { node: ExplainNode; depth: number }) {
  const children = node.details ?? [];
  const open = depth < 2;
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 14 }} className="border-l border-line pl-3">
      <div className="flex gap-2 py-0.5 text-[13px]">
        <span className="tnum w-20 shrink-0 text-right font-semibold">{node.value.toFixed(4)}</span>
        <span className="text-ink-muted">{node.description}</span>
      </div>
      {children.length > 0 && (
        <details open={open}>
          <summary className="cursor-pointer py-0.5 pl-6 text-[12px] text-pine">
            {children.length} contributing factor{children.length === 1 ? "" : "s"}
          </summary>
          {children.map((child, i) => (
            <ExplainTree key={i} node={child} depth={depth + 1} />
          ))}
        </details>
      )}
    </div>
  );
}
