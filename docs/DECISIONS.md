# NORDHEM — Decision Record

The output of the 2026-06-12 grill-me session. Append new decisions with date, choice, why, and rejected alternatives. These records are interview ore: "why did you choose X?" is answered here.

---

**D1 — Project concept** (2026-06-12)
A real e-commerce storefront (NORDHEM) + an admin Search Studio, not a bare search demo. Reusable for non-JYSK applications. Rejected: studio-only tool (too narrow for other jobs), search-page-only demo (doesn't show product thinking).

**D2 — Brand: NORDHEM, tagline "sleep, live, store"** (2026-06-12)
Nordic-home brand that works for any employer and doesn't read as a JYSK knock-off. Folder/repo: `nordhem`. Rejected: anything jysk-derived.

**D3 — Purchase flow depth** (2026-06-12)
Cart → demo checkout (address + fake payment) → real orders in Postgres → order history. Makes auth meaningful, completes the shop story. Rejected: Stripe test mode (a step of work, zero search value — can add later), cart-only (shop feels unfinished).

**D4 — Frontend: Next.js App Router** (2026-06-12)
Modern showcase + Antonio's existing skill + SSR e-commerce story. Validated by research: JYSK's own senior React posting requires Next.js; their new headless webshop direction matches. Search logic still lives in a separate Node service so the backend story stays clean. Rejected: Vite SPA (lighter but weaker standalone showcase).

**D5 — Engine: Elasticsearch primary** (2026-06-12)
Listed first in the job post, best docs/ecosystem, `_explain` API powers the studio's score visualizer, kNN + RRF free in basic license. Concepts transfer ~90% to OpenSearch/Solr. Rejected: Solr as primary (older ecosystem; but see D6), OpenSearch (fine, fewer learning resources).

**D6 — Solr as comparison lab, not platform; Drupal as knowledge, not code** (2026-06-12)
Research: JYSK historically ran Drupal multi-site + Search API + Solr with a Java commerce backend (Drupal.org case study), now migrating to headless Next.js. So: step 13 stretch = Solr container + narrow eval adapter → ES vs Solr benchmarked on identical corpus/judgments. Drupal: interview-bank knowledge only ("I read how your platform evolved"). Rejected: building on/learning Drupal (their legacy, weeks of cost, no transfer).

**D7 — Dataset: WANDS, two indexes** (2026-06-12)
WANDS (Wayfair, MIT-ish research license, github.com/wayfair/WANDS): 42,994 furniture products + 480 queries + 233,448 graded human judgments — furniture = JYSK's domain, judgments = honest nDCG. Shop index: ~800 curated products with photos. Benchmark index: full corpus, text-only (judgments need the full judged corpus to be meaningful). Configs graduate lab → shop. Rejected: full 43k in shop (stock photos can't match 43k specific products), synthetic catalog (loses human judgments), Amazon ESCI (not furniture).

**D8 — Images: Unsplash/Pexels APIs, hotlinked** (2026-06-12)
Free licenses incl. commercial use. Node pipeline tool: product → search phrase from its attributes → API → store CDN URL + photographer credit in Postgres. No downloading/hosting; hotlinking is what Unsplash API guidelines prefer. Manual swap UI for mismatches. Honest framing: photo represents the product type, not the literal SKU. Antonio already has an Unsplash key (portfolio `.env.local`).

**D9 — Auth: Better Auth** (2026-06-12)
Email+password + Google OAuth; users/sessions as tables in OUR Postgres next to orders/favorites — the "retailer owns customer identity" pattern (research: no public trace of any third-party IAM at JYSK; their accounts historically lived in their own platform). New learning vs repeating Clerk; ~half a day vs ~2 hours. Apple login skipped: $99/yr Apple dev account regardless of library. Rejected: Clerk (SaaS holds the users, no new learning), hand-rolled (days + footguns).

**D10 — Database: Postgres (Neon prod, Docker dev), Drizzle ORM** (2026-06-12)
Users/orders/favorites are relational with FKs; also stores search configs (synonyms, curations, boosts) with change history, analytics events, eval snapshots. Free interview line: project uses BOTH worlds — Postgres as system of record, Elasticsearch as non-relational document index, with an indexing pipeline between. Drizzle: TS-native, first-class Better Auth adapter.

**D11 — Hosting: free-tier split + PC search brain** (2026-06-12)
Antonio pays €0/month. Always-on free cloud: Vercel (Next.js) + Neon (Postgres) → login/cart/orders/favorites work 24/7; no user data on the PC. PC via Docker Compose: search service + ES (+ Solr later) + embeddings, exposed by free tunnel (Cloudflare Tunnel if domain is on Cloudflare, else Tailscale Funnel — decide at step 12). Noted honestly: 24/7 desktop power can cost more than a €5-9 VPS; PC runs during application pushes. A VPS can replace the PC later by repointing the tunnel/URL.

**D12 — Resilience: circuit breaker + lite mode** (2026-06-12)
Next.js backend calls the search service with ~800ms timeout; on failure falls back to Postgres full-text search on Neon (`websearch_to_tsquery` + `ts_rank`), responses tagged `mode: fallback`, UI banner explains + links to the blog post; studio status page shows component health; eval results cached in Postgres so the lab shows the last real run in lite mode. Framing: graceful degradation, a real production search pattern — the money constraint became an architecture showcase.

**D13 — Embeddings: local Transformers.js `multilingual-e5-small`** (2026-06-12)
Free, offline (no demo-day API risk), multilingual (Danish stretch), in-process in the Node service = deep talking points. One-time batch: shop index minutes, 43k benchmark ~30-40 min. Rejected: OpenAI embeddings in hot path (key + internet + cost; may return later as a provider-interface comparison experiment).

**D14 — Analytics: PostHog Cloud EU + first-party events, split roles** (2026-06-12)
PostHog (free 1M events/mo, EU hosting): product analytics — sessions, funnels, what visitors do. First-party Postgres events: search telemetry (query, result clicks + positions, zero-results) — ranking signals must live next to the engine, joinable in SQL with judgments/configs, no third-party dependency in the learning loop. Interview answer for "why not just PostHog?": signals that feed ranking are infrastructure, not analytics.

**D15 — Click-feedback learning loop** (2026-06-12)
Aggregation job: (query, product) click counts → affinity boost table in Postgres → applied at query time (bounded function_score overlay). Position-bias corrected (clicks-over-expected-clicks style normalization), capped so lexical/semantic relevance still dominates, cold-start safe (no data → no boost). Traffic: real visitors + honestly-labeled simulated sessions driven by WANDS judgments. Rejected: full Learning-to-Rank (parked stretch; overkill before the basics are measured).

**D16 — AI policy: subscription vs API, and no LLMs in the hot path** (2026-06-12)
Two different things: Antonio's Claude subscription powers Claude Code sessions (dev-time AI); the Anthropic API is separate pay-per-token billing (runtime AI). Therefore: (a) dev-time AI = in-session work — synonym/rewrite suggestions mined from zero-result + worst-eval queries, LLM-as-judge experiments — always landing as PROPOSALS in the editor-tools approval queue, human approves before anything ships; (b) runtime AI = shopping chatbot, Anthropic API with Haiku, tool-use over our own search API, FULL MODE ONLY (key lives on the PC; chatbot hidden in lite mode with honest banner). Expected chatbot cost at portfolio scale: a few dollars total. Principle worth saying in interviews: LLMs precompute or converse; they never sit between a keystroke and a results list.

**D17 — Teaching workflow** (2026-06-12)
Custom `teach-step` skill generates per-step self-contained HTML (recap, concepts, annotated real code, 8-12 question interactive quiz, "what the interviewer will ask" with model answers) into `teaching/` + index hub + learning-records loop (quiz results pasted back drive a review queue — retrieval practice borrowed from Matt Pocock's teach skill, which is also installed globally for ad-hoc deep dives, workspace-rooted at `learn/`). `grill-me`/`grill-with-docs` for mock interviews fed by `docs/interview-bank.md`.

**D18 — Blog workflow** (2026-06-12)
This repo feeds the portfolio's Scribe system, duplicating nothing: registered as `nordhem` in `scribe/projects.json`; per-step 1-3 idea cards proposed in chat → approved cards appended to `scribe/blog-ideas.md` (status `idea`) per `card-template.md`; drafting only on explicit ask, following `scribe/draft.md`, into Sanity as DRAFTS via MCP; publishing always manual by Antonio. Cadence: every step.

**D19 — Communication contract** (2026-06-12)
Decisions are discussed in plain text: research → findings (incl. what couldn't be found) → explicit recommendation + reasons → open prose question. No bare option dialogs. Antonio replies in his own words.

**D20 — Design system: fixed brand language via `nordhem-design` skill** (2026-06-12)
Research: installed `designer` (= Anthropic's official frontend-design skill) and `bencium` variant deliberately produce a DIFFERENT bold aesthetic per generation — right for one-offs, wrong for a product brand. So: project skill `nordhem-design` pins one direction (warm Nordic editorial: paper/linen surfaces, ink, pine accent, amber highlight, Fraunces display + Schibsted Grotesk body self-hosted, Motion + View Transitions, full e-commerce pattern library, craft/a11y checklist) and explicitly overrides the vary-each-time behavior. `ui-typography` (auto-enforcing) composes on top. Dark mode parked; light warm theme only.

**D21 — Testing strategy** (2026-06-12)
Analyzed even-steven: strong assertion craft, fixture builders, edge-case discipline (keep all of it); gaps: no CI, no coverage signal, unit/repo layers only, `--passWithNoTests`. NORDHEM: Vitest everywhere, Testcontainers for REAL Elasticsearch + Postgres in integration tests (search behavior is never mocked), Playwright e2e golden flows + axe scan, eval-metric fixtures hand-computed, CI gates from step 1. TDD loop = Matt Pocock's `tdd` skill (vertical tracer bullets, behavior through public interfaces). Anti-fake-green honesty rules codified in docs/TESTING.md (RED witnessed, no weakened assertions, expected values from outside the code, evidence-quoted GREEN, flaky = bug). Antonio's explicit requirement: tests must prove the thing works, not just pass.

**D23 — Teaching artifacts stay off GitHub** (2026-06-12)
Antonio's call: `teaching/`, `learn/`, `docs/interview-bank.md`, `docs/blog-moments.md` are gitignored. The public repo shows engineering; quizzes, lessons, rehearsed answers, and raw blog notes are personal. Cost: these exist only locally (no remote backup) — back up occasionally.

**D24 — Step 1 search is deliberately naive** (2026-06-12)
Dynamic mapping (no explicit schema) + default `multi_match` (best_fields, OR, no fuzziness/synonyms/boosts). Why: the relevance lab (step 6) needs an honest baseline; tuning before measuring is guessing, and every later improvement should be a measured delta, not folklore. Rejected: shipping stemming/boosts in step 1 (unfalsifiable improvements).

**D25 — Raw-SQL `ensureSchema` instead of drizzle-kit migrations (for now)** (2026-06-12)
One table (`products_raw`), no evolution history to manage; a CREATE TABLE IF NOT EXISTS bootstrap is honest about that. Proper migration files start in step 5 when auth/order tables make schema changes routine. Rejected: drizzle-kit migrations now (ceremony without evolution), letting tests create ad-hoc schemas (drift from production path).

**D26 — Contract changes are test-first; `productClass` went nullable** (2026-06-12)
The first real query returned a top hit with null `product_class`. Procedure now precedent: change the contract TEST (witness red), then the schema (green). The zod parse lives at every consumer boundary because TS types erase at runtime and services deploy independently. Rejected: coercing null to `""` at the producer (lies about data), `as SearchResponse` casts (verify nothing).

**D27 — Teaching HTML gains a code dojo and an embedded Claude tutor** (2026-06-12)
Antonio's call after reviewing step 1's lesson: reading is not enough. Every lesson now includes (a) a "code dojo" — 2-4 in-page exercises (write-from-scratch + fix-the-broken-code) with editors and vitest-style tests running via `new Function`, each verified before shipping (reference solution green, starter red); (b) a floating Claude tutor panel calling the Anthropic API directly from the browser (`anthropic-dangerous-direct-browser-access` CORS header, key in localStorage only, model dropdown defaulting to Opus, multi-turn thread, exercise context auto-attached). This is the one sanctioned exception to the lessons' zero-external-requests rule: optional, user-initiated, page fully functional offline without it. Quiz results still paste back to Claude Code sessions — browsers can't write learning-records. Rejected: a local proxy server (setup friction kills study sessions), embedding the key in the file (it's a key), WebLLM-style local models (quality too low for tutoring).

**D22 — Git workflow** (2026-06-12)
Analyzed even-steven (feature branches + merge commits, 60+ stale branches), habitflow (conventional-ish commits, squash), my-recipe-app (trunk, freeform). NORDHEM: public GitHub repo `Kizza00232Jera/nordhem` (created at Step 1 via gh), `main` always green, `step/NN-slug` branches, one squash-merged PR per step with real description (build log doubling as blog ore + visible process for recruiters), conventional commits, branch deletion after merge, GitHub Actions CI (typecheck/lint/unit on PR; integration via Testcontainers + build before merge; Playwright on golden-flow PRs), tags `v0.<step>` → `v1.0` at deploy. History itself is a portfolio artifact.
