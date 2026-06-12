# NORDHEM — sleep, live, store

A real, modern e-commerce storefront for Nordic home goods with a search-engineering brain. Built by Antonio as (1) the showcase project for the **JYSK Software Engineer, Search** application (https://job.jysk.dk/open-position/software-engineer-search), (2) a reusable portfolio piece for other applications, (3) a structured learning vehicle for search engineering + React interviews, and (4) a feeder of blog posts to his portfolio.

**This project is never just coding.** Every build step ends with teaching artifacts, interview prep, and blog material. See "Step ritual" below.

## Locked stack & architecture (full reasoning in docs/DECISIONS.md)

- **Frontend**: Next.js App Router + React 19 + Tailwind, deployed on Vercel (free, always on). Two surfaces: the NORDHEM storefront and the Search Studio (admin) under `/studio`.
- **Search service**: standalone Node.js + TypeScript + Fastify. Runs on Antonio's PC via Docker Compose, exposed through a free tunnel (Cloudflare Tunnel or Tailscale Funnel — decided at deploy step).
- **Engines**: Elasticsearch primary. Solr only as a comparison-lab stretch step (step 13). Kibana included locally for learning.
- **Database**: Postgres — Neon free tier in production (always on: users, sessions, cart, orders, favorites, synonyms, curations, boost rules, analytics events, eval snapshots), local Docker Postgres for dev. ORM: Drizzle.
- **Auth**: Better Auth (email+password + Google OAuth). Users live in our Postgres — the "retailer owns its customer data" pattern. No Apple login (needs $99/yr Apple dev account).
- **Catalog**: WANDS dataset (github.com/wayfair/WANDS) — 42,994 furniture products, 480 queries, 233k human relevance judgments. Two indexes: curated ~800-product **shop index** (with Unsplash/Pexels photos, hotlinked URLs + photographer credit) and full 43k **benchmark index** (text-only, powers the relevance lab).
- **Semantic search**: local embeddings via Transformers.js (`multilingual-e5-small`) inside the Node service. kNN + hybrid RRF. No embedding APIs in the hot path.
- **Resilience**: circuit breaker in the Next.js backend — if the PC search service is unreachable (~800ms timeout), fall back to **Postgres full-text search on Neon** ("lite mode") with an honest UI banner + status page. Full mode = PC up.
- **Analytics**: PostHog Cloud EU (free tier) for product analytics; **first-party events in Postgres** for search telemetry (query, clicks, positions, zero-results) that feeds ranking.
- **AI**: (a) offline/dev-time AI through Claude Code sessions (synonym suggestions, query analysis, LLM-as-judge experiments) — human-approved before anything ships; (b) runtime shopping chatbot via Anthropic API (Haiku) with tool-use over our search API — **full mode only**, hidden in lite mode. LLMs never sit in the search hot path.

## Key files

- `docs/PLAN.md` — roadmap + current status. **Read this first every session.**
- `docs/DECISIONS.md` — every decision with reasoning (the grill record). Append when new decisions are made.
- `docs/interview-bank.md` — accumulating interview Q&A. Append at every step wrap.
- `docs/blog-moments.md` — one-liners of blog-worthy moments. Append the moment something interesting happens, not later.
- `teaching/` — the per-step HTML course (see `.claude/skills/teach-step/SKILL.md`). `teaching/index.html` is the hub.
- `learn/` — if Antonio runs the global `/teach` skill in this repo, use `learn/` as its teaching workspace root (keep repo root clean).
- Note: `teaching/`, `learn/`, `docs/interview-bank.md`, `docs/blog-moments.md` are **gitignored** (personal study/prep, local only — see docs/GIT-WORKFLOW.md).

## Step ritual (non-negotiable)

Work proceeds in steps per `docs/PLAN.md`. While coding, narrate decisions so they can be taught afterwards. A step is DONE only when the `wrap-step` skill ritual has run: working demo verified → teaching HTML generated (`teach-step`) → blog cards proposed → interview bank updated → blog moments harvested → PLAN.md status updated → commit proposed.

## Blog pipeline (feeds the portfolio — never duplicate it here)

The portfolio's Scribe system at `D:\github\antonio-portfolio\scribe\` owns all blog style and publishing. This project is registered as `nordhem` in `scribe/projects.json`. Proposed cards follow `scribe/card-template.md` and are appended to `scribe/blog-ideas.md` as `idea` only after Antonio approves in chat. Drafting follows `scribe/draft.md` (four archetypes, voice anchors, slop ban, no dashes, first person) and creates Sanity **drafts** via the Sanity MCP. Publishing is always manual by Antonio in Sanity Studio.

## Working with Antonio

- For decisions: plain-text research summary → findings (including what could NOT be found) → explicit "my recommendation is X because A, B, C" → open question in prose. **Never bare AskUserQuestion option dialogs in discussions.**
- Explain while building: he wants to deeply understand everything that ships, especially search topics and React patterns — always with the JYSK interview in mind.
- He answers in his own words; treat his replies as the decision record and append to docs/DECISIONS.md.

## Conventions

- TypeScript strict everywhere. pnpm. Monorepo: `apps/web` (Next.js), `services/search` (Fastify), `packages/shared` (types/contracts), `data/` (WANDS downloads, gitignored), `tools/` (Node scripts: WANDS download, image pipeline, indexers).
- **All UI work**: apply the `nordhem-design` skill (`.claude/skills/nordhem-design/SKILL.md`) — the brand language is FIXED; it overrides the global designer skills' "new aesthetic each time" behavior. `ui-typography` enforcement applies on top.
- **All feature coding**: TDD via the global `tdd` skill (vertical tracer bullets), governed by `docs/TESTING.md` — the what-to-test matrix and the anti-fake-green honesty rules (RED witnessed in chat, no mocking the system under test, no weakened assertions, evidence-quoted GREEN).
- **All git activity**: per `docs/GIT-WORKFLOW.md` — `main` always green, `step/NN-slug` branches, one squash-merged PR per step with a real description, conventional commits, CI green before merge, tags per step.
- Secrets in `.env.local` files, never committed. Unsplash key can be copied from the portfolio's `.env.local`.
