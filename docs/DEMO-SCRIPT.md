# NORDHEM demo script

A "what to click and what to say" walkthrough for showing NORDHEM live (the JYSK
"Software Engineer, Search" interview). Each beat is one screen, one action, and
the one sentence that lands the point. It doubles as the shot list for
screenshots. Keep it to 8-12 minutes; the relevance lab is the centerpiece.

## Before you start (full mode on)
1. Docker up: `docker compose up -d` (Elasticsearch + Postgres).
2. Search service with the token: `$env:SEARCH_API_TOKEN="nordhem-search-2026"; pnpm -F @nordhem/search dev`.
3. Tunnel: `& "C:\Program Files\Tailscale\tailscale.exe" funnel 3001`.
4. Open two tabs: the live site `https://nordhem-web.vercel.app` and `http://localhost:3000`. Demo on the live site; fall back to localhost if the tunnel hiccups.
5. Be logged in as an editor (your Gmail or `demo@nordhem.app` / `nordhemdemo`) so `/studio` opens.

## The 30-second pitch (say first)
"NORDHEM is a real storefront with a production-shaped search service behind it. The storefront is on Vercel; the Elasticsearch engine runs on my machine and is reached over a tunnel; and when my machine is off the site degrades to a Postgres fallback instead of going down. The interesting half is the Search Studio, where I do the relevance-engineering work the role is about: measuring ranking against human judgments, tuning it, and adding semantic search, editor tools, and a learning loop."

## The beats

### 1. Query understanding [shot: search results for "vellvet couch"]
Open `/search?q=vellvet couch`. Say: "Misspelled and using a synonym, yet it returns velvet sofas. That is the analyzer chain: an English stemmer, fuzziness for the typo, and query-time synonyms mapping couch to sofa. Did-you-mean and autocomplete ride on the same index."

### 2. Facets and the query-vs-filter distinction [shot: facet sidebar with counts]
Tick a colour and a material. Say: "Facet counts come from Elasticsearch aggregations. The text query scores in query context; the filters run in filter context, unscored and cached; and multi-select facets use a post_filter so ticking white still shows black to add."

### 3. The relevance lab, the centerpiece [shot: /studio/relevance runs table]
Open `/studio/relevance`. Say: "This is how I know whether a change helped. Every config is scored against all 480 WANDS queries using 233,000 human judgments: nDCG@10 for ranking quality, MRR, recall@100. I do not eyeball relevance, I measure it." Open a run, then the compare view. Say: "Side-by-side runs, and the worst-queries list tells me what to fix next."

### 4. Semantic and hybrid [shot: search with the Keyword/Meaning/Hybrid toggle]
On `/search`, search "cozy reading nook" and toggle Keyword to Meaning to Hybrid. Say: "Keyword needs the literal words. Meaning uses local e5 embeddings and vector kNN. Hybrid fuses both with Reciprocal Rank Fusion, and it wins: nDCG@10 0.7284 versus 0.6615 lexical. Honest finding: semantic alone lifts ranking but drops recall, so hybrid is the trade that keeps both."

### 5. Editor tools [shot: /studio/relevance/synonyms and curations]
Open Synonyms. Say: "Editors manage synonyms here, stored in Postgres and hot-reloaded into Elasticsearch with no reindex, because synonyms are query-time." Open Curations. Say: "And per-query pin/hide, applied at search time. Every change is in an audit log and can be benchmarked against the judgments before it ships."

### 6. Analytics and resilience [shot: /studio/analytics, then /status]
Open `/studio/analytics`. Say: "First-party events: top queries, zero-result rate, click-through by position, latency percentiles." Open `/status`. Say: "And this is the resilience seam. Right now it is full mode."

### 7. The graceful-degradation moment [shot: /status in Lite mode, then /search still working]
Stop the tunnel terminal (Ctrl+C). Refresh `/status`. Say: "I just turned the engine off. A circuit breaker noticed within 800 milliseconds, opened, and the site fell back to Postgres full-text search. The storefront still works, honestly labelled lite mode. The site never 404s because my laptop is closed." Restart the tunnel to return to full mode.

### 8. The learning loop [shot: /studio/relevance/affinities]
Open `/studio/relevance/affinities`. Say: "Clicks become a ranking signal. A click deep in the results counts more than one at the top, because the shopper scrolled past everything above it, that is inverse-propensity weighting. It becomes a capped query-time boost. Offline job, never an LLM in the hot path. Measured lift nDCG 0.6560 to 0.6762, and I am candid that the synthetic-click number is an optimistic upper bound."

### 9. AI, human in the loop [shot: /studio/relevance/suggestions]
Open Suggestions. Say: "The assistant proposes synonyms for weak queries; a human approves or rejects. The heuristic even verifies against the live engine so it never suggests what the stemmer already solves. The chatbot, when configured, only calls the search API as a tool and summarises, it never ranks." Reject the obvious false positive to show the point.

### 10. The deploy architecture [shot: README architecture diagram]
Show the README diagram. Say: "Vercel for the storefront, Neon Postgres always on, the search engine on my PC over a tunnel, with the breaker and lite mode across the seam. The studio is locked behind an editor allowlist, and a visitor can even run the search service themselves and connect it to the live site for their own session." 

## Closing line
"Everything is test-driven and measured: I can show the red-green history, the eval numbers behind every relevance claim, and an honest account of what each change traded off. That measure-first habit is what I would bring to the search team."

## Screenshots to capture (for this script + the portfolio)
1. storefront home, 2. search results with facets (full mode), 3. a product page, 4. relevance lab runs + compare, 5. the search-mode toggle, 6. synonyms + curations editor, 7. analytics dashboard, 8. /status full vs lite, 9. learning-loop affinities, 10. suggestions queue, 11. README architecture diagram.
