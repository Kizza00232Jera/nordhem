---
name: teach-step
description: Generate the per-step teaching HTML (concepts, annotated real code, code-dojo exercises with in-page tests, interactive quiz, embedded Claude tutor, interviewer Q&A) after a build step finishes. Run as part of the wrap-step ritual or when Antonio asks to "teach step N".
---

# teach-step — the NORDHEM course generator

Antonio learns every step of this project deeply enough to defend it in the JYSK Software Engineer (Search) interview. Each build step produces ONE self-contained HTML teaching file. You are writing study material for a motivated learner, not documentation.

## Audience & voice (applies to every section, non-negotiable)

Antonio is a graduate student: smart and motivated, but NEW to most of this. Assume NO prior knowledge of TypeScript syntax, Elasticsearch jargon, backend architecture, or testing terminology. His explicit feedback (2026-06-12): earlier material explained code "in a way that somebody who doesn't understand what's written there" can't follow.

- **Everyday words first, the technical term second.** Introduce every term of art with a plain-words gloss at first use: "an endpoint (a URL the service answers on)", "idempotent (running it twice gives the same result)". After that, the term may be used bare within the same page.
- **Never explain code by restating it in denser jargon.** "A pure function from parameters to query DSL" is a failed explanation for this audience. Say what it does in everyday words, then name it.
- **Friendly and encouraging, never condescending.** Short sentences. It should read like a patient tutor sitting next to him, not a reference manual.
- **One concrete everyday analogy per concept** (back-of-book index, bouncer at the door), then drop it.
- Depth stays: the goal is still interview-grade understanding. Beginner-friendly means the ramp is gentle, not that the summit is lower.

## Inputs

1. `docs/PLAN.md` — the step's scope and teaching goals (the *Teaching:* line).
2. The step's actual code — Read the real files changed in this step. Never teach from memory of what you "probably wrote".
3. The conversation — decisions, surprises, and bugs from the build are the best teaching material.
4. `teaching/learning-records/` — prior weak spots; weave review questions on weak topics into the new quiz (spaced retrieval).

## Output

- `teaching/step-XX-<slug>.html` (e.g. `step-03-query-understanding.html`). Never overwrite a previous step's file.
- Update `teaching/index.html` (add/refresh the step card, refresh the review queue).
- When Antonio pastes quiz results back in chat: append `teaching/learning-records/NNNN-<slug>.md` (increment NNNN) with: date, step, score, list of missed topics, one-line takeaway per miss. These drive the review queue and future quiz composition.

## Required sections, in order

1. **What we built** — plain-language recap (150-300 words) + one inline-SVG architecture sketch showing what this step added (highlight the new parts).
2. **The concepts** — the search/React theory behind the step. Plain words first, then precision. Every mathematical idea gets a worked numeric example using OUR data (real product names, plausible numbers): BM25 scores computed by hand, nDCG for an example ranking, RRF fusion arithmetic. Analogies allowed, one per concept, then dropped.
3. **The real code, annotated** — 3-6 trimmed excerpts from actual repo files (cite path), each carrying inline `// comments` (VS Code style, via the `.c` span class) on the load-bearing lines so the snippet explains itself as you read it. The section OPENS with a "decoder" box explaining, once, the language constructs that recur in the snippets (`const`, `async`/`await`, arrow functions, type annotations, `export`, template strings — whatever this step's excerpts actually use). Then EVERY excerpt is followed by TWO blocks, in this order: (a) **"What this code does, line by line"** — a plain-words walkthrough where every keyword and call is explained as if the reader has never seen it ("`.map` means apply this function to every item in the list"); (b) **Why** — *why it's written this way* and *what breaks if you do the naive thing instead*, also in plain words. The line-by-line block is mandatory; an excerpt whose walkthrough would be too long is an excerpt that should be trimmed shorter.
4. **Code dojo** — see spec below. Active coding, not just reading.
5. **Quiz** — see spec below.
6. **What the interviewer will ask** — 5-10 likely questions for this step's topics. Each: a model answer in Antonio's first-person voice (2-5 sentences, confident, concrete numbers/names from the project), then a follow-up chain 2 levels deep ("...and if the index has two shards?"). Mark questions where the best move is *demoing* something in the project ("open the studio and show the _explain tree"). Sync the best ones into `docs/interview-bank.md`.
7. **Go deeper** — 1-3 primary sources max (official docs, the original paper, one excellent talk). Highest-trust only. Plus a closing reminder that the embedded tutor (and Claude in a session) answers follow-up questions.

Plus the **Claude tutor panel** (spec below) — present on every lesson page, floating bottom-right.

## Code dojo spec

- 2-4 exercises per step, ordered easiest → hardest, each tagged `basics` / `solid` / `interview-killer` like quiz questions.
- Mix two forms: **write-from-scratch** (empty function body + brief) and **fix-the-broken-code** (a plausible buggy version of something the step actually built — bugs a code review would catch, not typos).
- Each exercise: a dark monospace `<textarea>` editor (Tab inserts two spaces, vertical resize), **Run tests**, **Hint**, **Reset**, and **Ask the tutor about my code** buttons.
- Tests run in-page with `new Function` — vitest-style output (✓/✗ per test, expected vs received on failure, `N / M passed` summary). Exercises must be JS-expressible (tokenizers, query-DSL builders, metric math, fusion arithmetic, reducers); the lesson's TS code is adapted to plain JS for the editor.
- The **Hint** button is Claude-powered: it sends the exercise brief, latest test output, and the student's current editor code to the tutor server with the page's `HINT_SYSTEM` prompt, and writes the reply back INTO the editor — the student's code preserved exactly, with `// hint` comments inserted where things are wrong or missing (never the solution; if the editor still holds starter code, the comments sketch the steps instead). Each exercise still carries one pre-authored static hint as the offline fallback and as context shown after a smart hint. Copy the `HINT_SYSTEM` prompt and handler pattern from step-01.
- **Verify before shipping**: extract the exercise data + runner with Node and prove (a) a reference solution passes every test and (b) the starter code fails — an exercise whose starter already passes teaches nothing.
- "Ask the tutor about my code" opens the tutor panel with the exercise context attached to the next message: exercise title + brief, the student's current editor code, and the last test output.

## Claude tutor panel spec

The one sanctioned exception to "zero external requests": an OPTIONAL, user-initiated call to the **local tutor server** (`tools/tutor-server.mjs`, started with `pnpm tutor`, listening on `http://127.0.0.1:8765`). The server spawns the local `claude` CLI, so tutor answers bill Antonio's Claude subscription — NEVER generate an Anthropic API-key input or a direct `api.anthropic.com` fetch (that burns API credits; Antonio has explicitly forbidden it). The page must remain fully functional offline — when the server is unreachable the tutor shows "offline — run: pnpm tutor" and the failed question is recoverable.

- Floating toggle button bottom-right ("Tutor · ask Claude") opening a fixed chat panel.
- Setup row: a server status indicator (dot + "tutor server online" / "offline — run: pnpm tutor", refreshed via `GET /health` whenever the panel opens) + model dropdown with values `opus` (default), `sonnet`, `haiku`, persisted to `localStorage` key `nordhem-tutor-model`.
- First message in the thread is a note: runs through Claude Code on this PC on the subscription, no API key, no per-token charges, start with `pnpm tutor`, rest of the lesson works offline.
- `fetch` to `POST http://127.0.0.1:8765/tutor` with JSON body `{ model, system, messages, tools }`; response is `{ text }` or `{ error }`. On network failure, show the run-`pnpm tutor` hint and re-check `/health`.
- **Page context (the tutor can SEE the page):** build `PAGE_CONTEXT` once at load — `.wrap` innerText (capped ~33k chars) plus every SVG serialized as `PICTURE N ("aria-label"): … labels in order: <svg textContent>` — and send it appended to the system prompt on every chat request. Each question is also prefixed by `askExtras()`: the `h2` section currently on screen + any text the student has highlighted (`window.getSelection()`).
- **Research tools:** chat requests send `tools: ["WebSearch", "WebFetch"]` (the server allowlists exactly these; hint requests send none). The system prompt must state capabilities HONESTLY: it can see the whole page including PICTURE descriptions; it can search/fetch the web (prefer official docs, cross-check version numbers); it has NO file access/bash; it must never write pretend tool calls as text and never end a reply with a promise to "go look" — every reply complete in itself (the step-1 tutor once hallucinated a bash call and died mid-promise; this clause is why).
- Multi-turn: keep a `[{role, content}]` array for the page visit and send the whole thread each time (the server is stateless); on error, pop the failed user turn so the thread stays valid.
- System prompt per step (sent as `system` in the request body): tutor persona pitched at a **friendly beginner level** — Antonio is a graduate student, assume no TypeScript/Elasticsearch/backend prior knowledge, gloss every term of art in plain words, explain code line by line in everyday language, warm and encouraging, teach missing prerequisite concepts before the answer; plus the step's concept list (so it can answer without the lesson text), Antonio + interview context, and the format rules (plain text, no markdown, no em-dashes, under ~200 words, hint-before-solution for code, only full solutions on explicit request, connect answers to the real project and the interview, explained just as simply). Copy the persona/teaching-rules paragraphs from step-01's `TUTOR_SYSTEM` and only swap the concept list.
- Render the thread as plain-text chat bubbles (`white-space: pre-wrap`) — instruct the model to answer in plain text, don't ship a markdown renderer.
- Quiz learning records still flow through the **Copy results for Claude** button — a browser page cannot write `teaching/learning-records/`, so the paste-back loop stays.
- `tools/tutor-server.mjs` is shared by all steps — do not generate a new server per step; only the per-step system prompt in the HTML changes.

## Quiz spec

- 8-12 multiple-choice questions, 4 options each, exactly one correct.
- Difficulty tags shown on each question: `basics` / `solid` / `interview-killer` (at least 2 of each).
- Click an option → instant feedback: the correct answer is revealed AND every option gets one line on why it's right/wrong. Wrong options must be *plausible* (real misconceptions), never jokes.
- 1-2 questions per quiz revisit weak topics from learning records, marked `review`.
- Score panel at the end + a **"Copy results for Claude"** button that puts a compact summary on the clipboard (step, score, per-question topic + correct/missed) and tells Antonio to paste it in his next session.

## Style contract

- **One file, fully self-contained**: inline CSS, inline vanilla JS, inline SVG. ZERO external requests for assets (no CDNs, no fonts, no images) — files must open offline forever. The only network call allowed is the tutor panel's user-initiated call to the local tutor server (`127.0.0.1:8765`), and the page must degrade gracefully without it.
- NORDHEM-adjacent design tokens, defined inline: warm paper background `#FAF7F2`, ink `#20262E`, accent `#2F6F62`, amber highlight `#C8842C`, generous whitespace, max-width ~72ch for prose, system font stack with `Georgia`-ish serif for body or clean sans — readable like Tufte, not like a dashboard.
- Code blocks: dark panel, simple inline token highlighting (keywords/strings/comments via spans you emit yourself — no highlight.js).
- Print-friendly (`@media print`: hide quiz interactivity, show answers appendix).
- Works on mobile (he reviews on the phone).
- Language: addressed to Antonio ("you"), plain, no slop words, no em-dashes (his preference applies to prose he reads, not just blogs).

## index.html hub contract

Course dashboard: header with brand + progress (X of N steps), one card per step (number, title, 3-word concept list, quiz score if a learning record exists, link), a **Review queue** section listing weak topics from learning-records (topic, from which step, link to its section anchor), and a note pointing to `grill-me` for mock interviews.
