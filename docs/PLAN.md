# NORDHEM — Build Plan

> **STATUS (2026-06-13): Step 4 merged (PR #5, squashed, tagged `v0.4`). Next: Step 5 — The shop becomes a shop (auth, cart, checkout, orders, favorites).**
> Repo public at github.com/Kizza00232Jera/nordhem. Local stack: `docker compose up -d`, then `pnpm -F @nordhem/search dev` + `pnpm -F @nordhem/web dev`. Tutor for lessons: `pnpm tutor`.

Every step ends with the wrap-step ritual: working demo → `teaching/step-XX-*.html` with quiz + interviewer Q&A → blog cards proposed → `docs/interview-bank.md` updated → `docs/blog-moments.md` harvested → this file's status updated → commit. Steps are sized roughly an evening-to-weekend each.

## Steps

### ✅ Step 0 — Workspace setup (done 2026-06-12)
CLAUDE.md, docs (PLAN, DECISIONS, interview-bank, blog-moments), skills (`teach-step`, `wrap-step`, `nordhem-design`), Matt Pocock's `teach` installed globally, `nordhem` registered in portfolio `scribe/projects.json`, teaching hub shell, git init, memory migrated to the future folder path.

### ✅ Step 1 — Foundations (done 2026-06-12)
pnpm monorepo (`apps/web`, `services/search`, `packages/shared`, `tools`). Docker Compose: Elasticsearch 9.3.1 + Kibana + Postgres 17. WANDS downloaded and loaded (42,994 products in `products_raw`), naive dynamic-mapped ES index, `GET /search?q=` in Fastify (shared zod contract, nullable productClass learned from real data), bare Next.js 16 results page, CI (typecheck/lint/unit on PR + Testcontainers integration & build gate). PR #1.
*Teaching: what an inverted index is; analyzers 101; why Postgres (source of truth) and Elasticsearch (index) split the work; monorepo anatomy.* → `teaching/step-01-foundations.html`

### ✅ Step 2 — Storefront + catalog curation + PostHog (done 2026-06-12)
800 products curated across 8 categories (deterministic selection + Knuth-hash synthetic prices). Unsplash pipeline: 45 requests for 800 photos via per-class pooling, credit stored, studio swaps survive re-runs. NORDHEM design system live (Fraunces + Schibsted, paper/pine/amber); home, PLP, PDP, card-grid search. `products-shop` ES index + `scope=shop|all`. Studio v0 image review with swap. PostHog EU with `project: nordhem` super property. `@nordhem/db` extracted (lite-mode browsing). Local tutor server (`pnpm tutor`, D28). PR #2.
*Teaching: data pipeline design; App Router patterns (server components, streaming, caching); image CDNs/hotlinking.* → `teaching/step-02-storefront.html`

### ✅ Step 3 — Query understanding (built 2026-06-13, PR pending)
Explicit mappings (`dynamic: strict`) with custom english chain (possessive → lowercase → stop → stemmer); `name` multi-fields keyword/trigram/sayt. Boosted `best_fields` (name^3, product_class^2) + fuzziness AUTO. Query-time synonyms (`synonyms.txt` → synonym_graph AFTER the stemmer, search-analyzer only — no reindex on rule edits). Did-you-mean phrase suggester over unstemmed shingles (optional `suggestion` in contract). `/autocomplete` (search_as_you_type + bool_prefix) → Next `/api/autocomplete` proxy (800ms cap, degrades silently). ARIA combobox in header (debounce 200ms + AbortController, arrows/enter/escape, URL-synced) with new apps/web Vitest+RTL rig. Highlighting rendered by `<mark>`-splitting, never innerHTML. Verified on real data: "vellvet"→22 hits highlighted, "couch"→122 sofas, "platfrom bed"→"platform bed", "vel"→8 suggestions. D33–D37.
*Teaching: the analysis chain end to end; BM25 intro; edit distance; multi_match types. Densest interview zone.* → `teaching/step-03-query-understanding.html`

### ✅ Interlude 3.5 — Query DSL compendium (teaching only, built 2026-06-13)
`teaching/step-03.5-query-dsl.html`: one section each for `match`, `multi_match`, `term`, `bool` (must/should/filter/must_not + query vs filter context), `range`, `match_all`, plus the framing rule (`query` holds exactly one type describing HOW to look). NORDHEM-flavored DSL examples, three verified dojo exercises (envelope/match, fix-the-bool, assemble the storefront bool), 9-question quiz, interviewer Q&A, tutor. Hub card added.

### ✅ Step 4 — Facets & filters (done 2026-06-13, PR #5, v0.4)
JYSK-modelled (Playwright-researched) category-scoped facets with live ES aggregation counts. Universal spine: category (terms), colour + material (terms, extracted from WANDS `product_features` via `wands/features.ts`), price (range over fixed bands). Query vs filter context: multi_match in `bool.must`; category/price cross-cutting in `bool.filter`; colour/material multi-select in `post_filter` (keeps own counts — "tick white, still see black"). Sort (relevance/price asc/desc) + pagination. Facet sidebar UI with counts, chips, clear-all, URL-synced via pure helpers (`lib/facet-url`). Verified live (800-product shop) + 27 ES integration tests. D38–D41.
*Teaching: aggregations; post_filter for multi-select facets; why filters cache and queries score.* → `teaching/step-04-facets-filters.html`

### ⬜ Step 5 — The shop becomes a shop
Better Auth (email+password + Google). Cart (guest cart + merge-on-login), demo checkout (address form, fake payment), orders in Postgres, order history, favorites (hearts + favorites page — mirrors jysk.dk's "Favoritter").
*Teaching: sessions & cookies; cart merge strategies; transactional order creation with Drizzle.*

### ⬜ Step 6 — Relevance lab: measurement
Benchmark index: full 42,994 products. Load 480 queries + 233k judgments. Eval harness in Node: run query set, compute nDCG@10, MRR, recall@100. Experiment runs stored in Postgres; studio UI: run experiment, per-query scores, worst-queries table, side-by-side run comparison.
*Teaching: nDCG with a worked numeric example; offline vs online evaluation; why eyeballing lies. The differentiator step.*

### ⬜ Step 7 — Relevance lab: tuning
Field-boost tuning UI (sliders → instant re-eval), popularity signals via function_score (rating_count/review_count), `_explain` score-breakdown visualizer, train/test query split (don't overfit judgments), "graduate winning config to shop index".
*Teaching: BM25 k1/b; boosting strategies; reading _explain; overfitting in relevance tuning.*

### ⬜ Step 8 — Semantic & hybrid search
Embedding pipeline (Transformers.js `multilingual-e5-small`, e5 query/passage prefixes), `dense_vector` + kNN, hybrid RRF fusion. Benchmark lexical vs semantic vs hybrid with real nDCG numbers. Zero-result rescue analysis. Semantic toggle in storefront.
*Teaching: embedding intuition; HNSW; RRF math; when semantic helps and hurts.*

### ⬜ Step 9 — Editor tools (the job-post requirement)
Studio CRUD for: synonyms (Postgres-stored, hot-reloaded into ES), curations (pin/hide products per query), boost rules — all with change history (who/when/what). Each change can be re-evaluated against the benchmark BEFORE applying. This is "develop tools in Node.JS to help editors improve search" made literal.
*Teaching: search governance; synonym_graph mechanics (query-time vs index-time); curation patterns.*

### ⬜ Step 10 — Analytics & resilience
First-party event tracking (search_performed, result_clicked w/ position, zero_result) → Postgres. Dashboards: top queries, zero-result rate, CTR by position. Simulated traffic generator (judgment-driven click model, honestly labeled). Circuit breaker + Postgres FTS fallback ("lite mode") + live status page. Profile API, latency histograms.
*Teaching: search KPIs; position bias; circuit breakers & graceful degradation; query profiling.*

### ⬜ Step 11 — The learning loop + AI
(a) Click-feedback ranking: aggregate (query, product) clicks → affinity boosts applied at query time, position-bias-corrected, capped; nightly job. (b) AI editor assistant: zero-result + worst queries analyzed in Claude Code sessions → suggested synonyms/rewrites land in the editor-tools approval queue (human in the loop). (c) Shopping chatbot: Anthropic API (Haiku) with tool-use calling OUR search API ("I need something for a small bedroom"), full mode only. Optional: LLM-as-judge vs WANDS labels agreement experiment.
*Teaching: implicit feedback & position bias correction; LLM tool-use architecture; why LLMs stay out of the hot path.*

### ⬜ Step 12 — Deploy & presentation
Vercel (web) + Neon (Postgres) + tunnel (Cloudflare/Tailscale) + lite/full modes live end-to-end. README with architecture diagrams, interview demo script, screen recording for lite-mode visitors, portfolio project page.
*Teaching: the deployment architecture itself; what breaks across the seam.*

### ⬜ Step 13 — STRETCH: Solr comparison lab
Solr container, same 43k corpus, narrow adapter (query → ranked IDs) in the eval harness, ES vs Solr side-by-side: relevance, latency, feature notes. Only if time before applications.

**Parked stretch ideas**: Danish/multilingual search demo (e5 is multilingual), Learning to Rank, OpenAI embeddings comparison behind a provider interface.
