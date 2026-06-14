"use client";

import { useState, useTransition } from "react";
import {
  cardsByIdsAction,
  getCurationAction,
  saveCurationAction,
  searchShopAction,
} from "../actions/curations";
import type { ProductCard } from "../../lib/curations-repo";
import { formatPrice } from "../../lib/format";

function CardRow({
  card,
  children,
}: {
  card: ProductCard;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px]">{card.name}</p>
        {card.priceCents != null && (
          <p className="tnum text-[12px] text-ink-muted">{formatPrice(card.priceCents)}</p>
        )}
      </div>
      {children}
    </div>
  );
}

const btn = "rounded-xs border border-line px-2 py-0.5 text-[12px] hover:border-ink";

export function CurationsEditor() {
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<number[]>([]);
  const [pinned, setPinned] = useState<number[]>([]);
  const [hidden, setHidden] = useState<number[]>([]);
  const [cards, setCards] = useState<Map<number, ProductCard>>(new Map());
  const [pickQuery, setPickQuery] = useState("");
  const [pickResults, setPickResults] = useState<number[]>([]);
  const [view, setView] = useState<"after" | "before">("after");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cardOf = (id: number): ProductCard => cards.get(id) ?? { id, name: `#${id}`, slug: null, priceCents: null, imageThumbUrl: null };
  const addCards = (list: ProductCard[]) =>
    setCards((m) => {
      const next = new Map(m);
      for (const c of list) next.set(c.id, c);
      return next;
    });

  function load() {
    const q = query.trim();
    if (!q) return;
    setStatus(null);
    startTransition(async () => {
      const [hits, cur] = await Promise.all([searchShopAction(q), getCurationAction(q)]);
      addCards(hits);
      const missing = [...cur.pinned, ...cur.hidden].filter((id) => !hits.some((h) => h.id === id));
      if (missing.length) addCards(await cardsByIdsAction(missing));
      setBaseline(hits.map((h) => h.id));
      setPinned(cur.pinned);
      setHidden(cur.hidden);
      setPickResults([]);
      setPickQuery("");
      setLoaded(q);
    });
  }

  function runPick() {
    const q = pickQuery.trim();
    if (!q) return;
    startTransition(async () => {
      const hits = await searchShopAction(q);
      addCards(hits);
      setPickResults(hits.map((h) => h.id));
    });
  }

  const pin = (id: number) => {
    setHidden((h) => h.filter((x) => x !== id));
    setPinned((p) => (p.includes(id) ? p : [...p, id]));
  };
  const unpin = (id: number) => setPinned((p) => p.filter((x) => x !== id));
  const hide = (id: number) => {
    setPinned((p) => p.filter((x) => x !== id));
    setHidden((h) => (h.includes(id) ? h : [...h, id]));
  };
  const unhide = (id: number) => setHidden((h) => h.filter((x) => x !== id));
  const moveUp = (id: number) =>
    setPinned((p) => {
      const i = p.indexOf(id);
      if (i <= 0) return p;
      const next = [...p];
      [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
      return next;
    });

  function save() {
    if (!loaded) return;
    setStatus(null);
    startTransition(async () => {
      const res = await saveCurationAction(loaded, { pinned, hidden });
      setStatus(res.ok ? "Saved. Live on the next search for this query (no reindex, no reload)." : res.error);
    });
  }

  const hiddenSet = new Set(hidden);
  const pinnedSet = new Set(pinned);
  const afterOrder = [...pinned, ...baseline.filter((id) => !pinnedSet.has(id) && !hiddenSet.has(id))];
  const beforeOrder = baseline;
  const previewOrder = view === "after" ? afterOrder : beforeOrder;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-[13px]">
          <span className="mb-1 block text-ink-muted">Query to curate</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="e.g. sofa"
            className="h-9 w-64 rounded-xs border border-line bg-card px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-pine"
          />
        </label>
        <button type="button" onClick={load} disabled={pending} className="h-9 rounded-xs bg-pine px-4 text-[14px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50">
          {pending ? "Loading…" : "Curate"}
        </button>
        {loaded && (
          <button type="button" onClick={save} disabled={pending} className="h-9 rounded-xs border border-line px-4 text-[14px] font-medium hover:border-ink disabled:opacity-50">
            Save curation
          </button>
        )}
      </div>
      {status && <p className="mt-3 text-[13px] text-pine">{status}</p>}

      {!loaded ? (
        <p className="mt-8 max-w-2xl rounded-md border border-dashed border-line p-8 text-center text-[14px] text-ink-muted">
          Type a query and press Curate. You&rsquo;ll pin products to the top or hide them for that exact query;
          changes go live on the next search (curations are read at query time, no reindex).
        </p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* LEFT: the rule */}
          <section>
            <h2 className="text-[15px] font-semibold">Curating &ldquo;{loaded}&rdquo;</h2>

            <h3 className="mt-4 text-[13px] font-semibold text-ink-muted">Pinned to top ({pinned.length})</h3>
            <div className="mt-1 rounded-md border border-line bg-card px-3">
              {pinned.length === 0 ? (
                <p className="py-3 text-[13px] text-ink-muted">None pinned.</p>
              ) : (
                pinned.map((id) => (
                  <CardRow key={id} card={cardOf(id)}>
                    <button type="button" className={btn} onClick={() => moveUp(id)} aria-label="Move up">↑</button>
                    <button type="button" className={btn} onClick={() => unpin(id)}>Unpin</button>
                  </CardRow>
                ))
              )}
            </div>

            {hidden.length > 0 && (
              <>
                <h3 className="mt-4 text-[13px] font-semibold text-ink-muted">Hidden ({hidden.length})</h3>
                <div className="mt-1 rounded-md border border-line bg-card px-3">
                  {hidden.map((id) => (
                    <CardRow key={id} card={cardOf(id)}>
                      <button type="button" className={btn} onClick={() => unhide(id)}>Unhide</button>
                    </CardRow>
                  ))}
                </div>
              </>
            )}

            <h3 className="mt-5 text-[13px] font-semibold text-ink-muted">Results for this query</h3>
            <div className="mt-1 rounded-md border border-line bg-card px-3">
              {baseline.filter((id) => !pinnedSet.has(id) && !hiddenSet.has(id)).slice(0, 12).map((id) => (
                <CardRow key={id} card={cardOf(id)}>
                  <button type="button" className={btn} onClick={() => pin(id)}>Pin</button>
                  <button type="button" className={btn} onClick={() => hide(id)}>Hide</button>
                </CardRow>
              ))}
            </div>

            <h3 className="mt-5 text-[13px] font-semibold text-ink-muted">Pin a product not in these results</h3>
            <div className="mt-1 flex gap-2">
              <input
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runPick()}
                placeholder="search the catalog…"
                className="h-9 flex-1 rounded-xs border border-line bg-card px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-pine"
              />
              <button type="button" onClick={runPick} disabled={pending} className={btn + " px-3"}>Search</button>
            </div>
            {pickResults.length > 0 && (
              <div className="mt-1 rounded-md border border-line bg-card px-3">
                {pickResults.filter((id) => !pinnedSet.has(id)).slice(0, 8).map((id) => (
                  <CardRow key={id} card={cardOf(id)}>
                    <button type="button" className={btn} onClick={() => pin(id)}>Pin</button>
                  </CardRow>
                ))}
              </div>
            )}
          </section>

          {/* RIGHT: before/after preview */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Preview</h2>
              <div className="inline-flex rounded-xs border border-line p-0.5 text-[12.5px]">
                {(["before", "after"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setView(v)} className={`rounded-xs px-3 py-1 ${view === v ? "bg-pine font-semibold text-white" : "text-ink-muted hover:text-ink"}`}>
                    {v === "before" ? "Before" : "After"}
                  </button>
                ))}
              </div>
            </div>
            <ol className="mt-3 rounded-md border border-line bg-card px-3">
              {previewOrder.slice(0, 14).map((id, i) => (
                <li key={id} className="flex items-center gap-3 border-t border-line py-2 text-[13.5px] first:border-t-0">
                  <span className="tnum w-5 shrink-0 text-right text-ink-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{cardOf(id).name}</span>
                  {view === "after" && pinnedSet.has(id) && (
                    <span className="rounded-xs bg-pine px-1.5 py-0.5 text-[11px] font-semibold text-white">pinned</span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
