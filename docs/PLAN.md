# NORDHEM — Build Plan

> **STATUS (2026-06-13): Step 5 merged + tagged v0.5. Step 6 (relevance lab: measurement) BUILT and verified on branch `step/06-relevance-lab` (5 slices): nDCG@10/MRR/recall metrics, WANDS eval set in Postgres (480 queries, 231,873 judgments), eval harness + run-eval CLI, persisted runs + per-query scores, and the Studio relevance lab UI (runs list, run detail with worst-queries, side-by-side compare). Verified baseline: nDCG@10 0.6532, MRR 0.8701, recall@100 37.5%. Green: 37 search unit + search integration (real PG) + web typecheck/lint. NEXT: wrap ritual (the larger Step 6 teaching HTML on nDCG/offline eval, blog ideas, interview bank), then the Step 6 PR.**
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

### ✅ Step 5 — The shop becomes a shop (COMPLETE, branch `step/05-shop-becomes-a-shop`)
Better Auth (email+password + Google), guest cart with merge-on-login, demo checkout (address + fake payment), orders in Postgres, order history, favorites (hearts + favorites page, the jysk.dk "Favoritter" model).

**SHIPPED (2026-06-13):** all 11 slices done across schema → repos (real-PG integration tests) → contracts → Server Actions → optimistic UI → Playwright golden-flow e2e. Decisions D42–D44. Green: 29 web unit, 16 web integration, 2 e2e, plus typecheck/lint/build. Remaining before merge: wrap ritual (teaching HTML + interview bank) and the squash PR. The checklist below is the original build plan, kept for reference.

**ORIGINAL PLAN (for reference):**

DONE so far:
- Branch cut off `main`. Cart math helpers in `apps/web/lib/` (`cart-totals.ts`, `cart-merge.ts`) with 10 green unit tests (`apps/web/test/cart-totals.test.ts`, `cart-merge.test.ts`). Committed.

DECISIONS adopted from the plan (record as D42 to D44 at wrap):
- Guest cart is a DB `cart` row keyed by a `cart_id` cookie (not cookie-only), so merge-on-login is a clean DB operation and the cart survives a device switch.
- Favorites require login; a guest heart click prompts sign-in (no guest favorites table).
- Order numbers are human-readable `NDH-2026-000123` (uuid internal pk plus a sequence-backed `orderNumber`).
- drizzle-kit migrations for the real DB, but keep `ensureSchema` synced for the test/dev bootstrap (every integration test uses it).
- Email+password always works; the Google button is env-gated (hidden when `GOOGLE_CLIENT_ID` is absent), so CI and a fresh clone never need secrets.
- Orders snapshot name+slug+image+unit price at checkout; order history must never re-derive price from live `shop_products`.

NEXT SLICES (TDD, RED witnessed in chat, real Postgres via `@testcontainers/postgresql` for DB behaviour, pure units for logic; copy the PG test pattern from `tools/test/integration/write-shop.test.ts`):
1. Infra: add `drizzle-kit` + `drizzle.config.ts` + `packages/db/migrations/`; add `@testcontainers/postgresql` + `testcontainers` devDeps to `apps/web`; install `better-auth` in `apps/web`.
2. Auth schema: configure `apps/web/lib/auth.ts` (Better Auth, Drizzle adapter on the `lib/db.ts` `db()` singleton, emailAndPassword + google social provider), run the Better Auth CLI to GENERATE the `user`/`session`/`account`/`verification` tables (do NOT hand-write them, version drift), port into `packages/db/src/schema.ts` + `ensure-schema.ts`. Mount `app/api/auth/[...all]/route.ts`. Add `lib/session.ts` (getSession via `headers()`).
3. Data model: `cart` (uuid pk, nullable `userId` -> user, timestamps, one active cart per user), `cart_items` (cartId cascade, productId -> shop_products, quantity, unique(cartId,productId) upsert, no price column), `orders` (uuid pk, unique `orderNumber`, userId, status, ship address cols, subtotal/shipping/total cents), `order_items` (orderId cascade, productId plain ref, nameSnapshot/slugSnapshot/imageUrlSnapshot/unitPriceCents/quantity), `favorites` (composite pk userId+productId, both cascade). Add to schema.ts + ensureSchema.
4. Auth persistence (real PG): signup/login writes user + account (hashed password, not plaintext) + session; getSession returns the user. Google is NOT integration-tested (third-party external).
5. Cart repo (real PG): addToCart upsert bumps quantity; apply mergeCarts (guest + user cart -> summed, guest row deleted).
6. Checkout (real PG): `db.transaction` turns the cart into orders + order_items (snapshotted) and clears the cart, atomically; empty cart rejected; mutate a `shop_products` price AFTER and prove the order snapshot did not move; a forced mid-transaction error leaves no order and the cart intact.
7. Favorites (real PG): toggleFavorite idempotent and per-user.
8. Optimistic UI (RTL): cart drawer + favorite button, `useOptimistic` apply then rollback on a rejected Server Action.
9. Contracts (`@nordhem/shared`): AddressSchema, CartViewSchema, OrderSummarySchema (zod, validated at the Server Action boundary).
10. UI: `/login` + `/signup`, cart drawer + `/cart`, `/checkout` (address form with proper `autocomplete` attributes + fake-payment banner), order history + confirmation, `/favorites`; wire the currently-inert Heart and Bag icons in `apps/web/app/components/site-header.tsx` and enable the disabled Add-to-cart in `apps/web/app/product/[slug]/page.tsx`.
11. E2e golden flow (Playwright, set it up in apps/web): search -> PDP -> add to cart -> checkout -> order in history; favorites persist across reload.

NEEDS ANTONIO (only for the live Google button, not a blocker for the backend): Google Cloud Console OAuth 2.0 Client ID + secret, redirect URI `http://localhost:3000/api/auth/callback/google`, into `apps/web/.env.local` along with `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Email+password and every backend slice proceed without these.

KEY FILES: `packages/db/src/schema.ts` + `ensure-schema.ts`; `apps/web/lib/db.ts` (the shared `db()` singleton the Better Auth adapter and repos must reuse); `apps/web/app/components/site-header.tsx` (inert heart/bag); `apps/web/app/product/[slug]/page.tsx` (disabled add-to-cart). Dev stack: `docker compose up -d` (Postgres has the full catalog; shop index already re-indexed with colour/material). Heed `apps/web/AGENTS.md`: read the bundled Next docs for route handlers, `cookies()`, `headers()`, Server Actions before writing auth/cart code.

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
