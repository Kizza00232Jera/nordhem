---
name: teach-step
description: Generate the per-step teaching HTML (concepts, annotated real code, interactive quiz, interviewer Q&A) after a build step finishes. Run as part of the wrap-step ritual or when Antonio asks to "teach step N".
---

# teach-step — the NORDHEM course generator

Antonio learns every step of this project deeply enough to defend it in the JYSK Software Engineer (Search) interview. Each build step produces ONE self-contained HTML teaching file. You are writing study material for a motivated engineer, not documentation.

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
3. **The real code, annotated** — 3-6 trimmed excerpts from actual repo files (cite path), each followed by *why it's written this way* and *what breaks if you do the naive thing instead*.
4. **Quiz** — see spec below.
5. **What the interviewer will ask** — 5-10 likely questions for this step's topics. Each: a model answer in Antonio's first-person voice (2-5 sentences, confident, concrete numbers/names from the project), then a follow-up chain 2 levels deep ("...and if the index has two shards?"). Mark questions where the best move is *demoing* something in the project ("open the studio and show the _explain tree"). Sync the best ones into `docs/interview-bank.md`.
6. **Go deeper** — 1-3 primary sources max (official docs, the original paper, one excellent talk). Highest-trust only. Plus a closing reminder: "Ask Claude follow-up questions about anything unclear — that's what the teacher is for."

## Quiz spec

- 8-12 multiple-choice questions, 4 options each, exactly one correct.
- Difficulty tags shown on each question: `basics` / `solid` / `interview-killer` (at least 2 of each).
- Click an option → instant feedback: the correct answer is revealed AND every option gets one line on why it's right/wrong. Wrong options must be *plausible* (real misconceptions), never jokes.
- 1-2 questions per quiz revisit weak topics from learning records, marked `review`.
- Score panel at the end + a **"Copy results for Claude"** button that puts a compact summary on the clipboard (step, score, per-question topic + correct/missed) and tells Antonio to paste it in his next session.

## Style contract

- **One file, fully self-contained**: inline CSS, inline vanilla JS, inline SVG. ZERO external requests (no CDNs, no fonts, no images) — files must open offline forever.
- NORDHEM-adjacent design tokens, defined inline: warm paper background `#FAF7F2`, ink `#20262E`, accent `#2F6F62`, amber highlight `#C8842C`, generous whitespace, max-width ~72ch for prose, system font stack with `Georgia`-ish serif for body or clean sans — readable like Tufte, not like a dashboard.
- Code blocks: dark panel, simple inline token highlighting (keywords/strings/comments via spans you emit yourself — no highlight.js).
- Print-friendly (`@media print`: hide quiz interactivity, show answers appendix).
- Works on mobile (he reviews on the phone).
- Language: addressed to Antonio ("you"), plain, no slop words, no em-dashes (his preference applies to prose he reads, not just blogs).

## index.html hub contract

Course dashboard: header with brand + progress (X of N steps), one card per step (number, title, 3-word concept list, quiz score if a learning record exists, link), a **Review queue** section listing weak topics from learning-records (topic, from which step, link to its section anchor), and a note pointing to `grill-me` for mock interviews.
