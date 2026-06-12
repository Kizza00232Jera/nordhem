---
name: wrap-step
description: The end-of-step ritual for NORDHEM. Run when a build step is finished or Antonio says "wrap step N" / "step done". Verifies the demo, generates teaching HTML, proposes blog cards, updates interview bank and plan, proposes the commit.
---

# wrap-step — a step is only done when this ritual ran

Run the checklist IN ORDER. Report honestly: if verification fails, the step is not done — fix first, wrap after.

## 1. Verify
- The definition of done in `docs/TESTING.md` holds: typecheck + lint + unit green; integration green if the step touched search/db behavior; e2e green if it touched a golden flow. Quote the test run summary as evidence.
- Walk the step's demo checklist from `docs/PLAN.md` — actually exercise the feature (run the dev servers, hit the endpoints, click through). State what was verified and how. No "should work".

## 2. Teach
- Run the `teach-step` skill for this step (see `.claude/skills/teach-step/SKILL.md`).
- Remind Antonio: if the previous step's quiz results were never pasted back, ask for them now (learning records feed the review queue).

## 3. Interview bank
- Append this step's 3-6 strongest Q&As to `docs/interview-bank.md` (same format as the file). No duplicates — extend existing entries instead.

## 4. Blog moments
- Harvest the step: append any blog-worthy moments to `docs/blog-moments.md` (dated one-liners). Surprises, numbers, decisions with teeth — not "implemented feature X".

## 5. Blog cards (portfolio Scribe contract — never skip the approval gate)
- Read `D:\github\antonio-portfolio\scribe\card-template.md` and the tail of `D:\github\antonio-portfolio\scribe\blog-ideas.md` for current format/statuses.
- Propose 1-3 cards IN CHAT: working title, archetype (hybrid/technical/reflective/explainer), the angle, and why it earns a place (one line each).
- Only after Antonio approves a card: append it to `scribe/blog-ideas.md` with status `idea` following the template exactly.
- Drafting a post happens ONLY on his explicit ask, follows `scribe/draft.md` to the letter (voice anchors, slop ban, no dashes, 1,200-2,500 words, real code from this repo via `projects.json` entry `nordhem`), and is created in Sanity as a DRAFT via the Sanity MCP. Never publish — publishing is Antonio in Sanity Studio, always.

## 6. Records
- Update `docs/PLAN.md`: step checkbox + STATUS line (next step).
- Append any new decisions made during the step to `docs/DECISIONS.md` (date, choice, why, rejected alternatives).

## 7. Commit
- Propose a conventional commit message (`feat(search): step 3 — query understanding (analyzers, fuzziness, suggest)`). Commit only after he approves.

## 8. Offer
- Offer a `grill-me` mock-interview round on this step's topics (fed by `docs/interview-bank.md`), and name the next step with its first concrete task so the next session starts instantly.

Close with a short summary linking every artifact produced (teaching file, cards appended, bank entries, commit hash).
