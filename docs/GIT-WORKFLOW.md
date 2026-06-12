# NORDHEM — Git & GitHub Workflow

Referenced from CLAUDE.md. Designed from what worked across Antonio's repos (habitflow's conventional commits, even-steven's feature branches) while fixing what rotted (60+ stale branches, no CI, freeform messages, master/main inconsistency). This repo is also a *portfolio artifact*: recruiters and the JYSK team will read the history. The history should read like a senior engineer worked here.

## The shape

- **Remote**: GitHub `Kizza00232Jera/nordhem`, public. Created at the start of Step 1 (after the folder rename) via `gh repo create`.
- **Default branch**: `main`. Always green (typecheck + tests pass), always demoable. Never force-pushed, never committed to directly except step-0-style docs-only changes.
- **One branch per step**: `step/01-foundations`, `step/03-query-understanding`. Small out-of-step work uses `fix/<slug>` or `chore/<slug>`. Branches are deleted after merge — no stale pile.
- **One PR per step**, even solo. The PR description is written properly: what was built, decisions made, screenshots/GIFs of the demo, metrics if any (eval scores!). This doubles as the build log, feeds blog cards, and shows process to anyone reading the repo. Merge = **squash** (main reads one clean commit per step), PR number preserved in the squash title.
- **Conventional commits** on branches: `feat(search): fuzzy matching with AUTO fuzziness`, `test(eval): hand-computed ndcg fixtures`, `fix(web): combobox focus trap`, `chore`, `docs`, `refactor`, `perf`. Imperative, lower-case, scope = package or domain.
- **Tags**: `v0.<step>` at each merged step (`v0.1` = foundations live), `v1.0` at Step 12 (deployed). Cheap, and the tag list becomes a visible changelog of the journey.

## CI (GitHub Actions, from Step 1)

- **On every PR**: install (pnpm cache) → typecheck → lint → unit tests.
- **Before merge (same workflow)**: integration tests (Testcontainers — GitHub's ubuntu runners ship Docker) → build all packages.
- **e2e (Playwright)**: on PRs that touch `apps/web` golden flows; nightly otherwise. Skipped jobs must be visibly skipped, never silently green.
- A red check blocks merge. No `--no-verify`, no merging around CI "just this once".

## Cadence & hygiene

- Commit at every coherent unit of work (roughly each green tdd cycle or each wrap-step substep), push at least at the end of every work session — the PC is not the backup.
- Commits proposed by Claude, approved by Antonio (wrap-step step 7). Messages never mention AI tooling; they describe the change.
- `.env*` never committed (`.env.example` documents the shape). WANDS data stays in gitignored `data/` — the download tool is committed, the CSVs are not.
- **Public vs local**: the repo showcases engineering (code, PLAN, DECISIONS, TESTING, GIT-WORKFLOW, skills). Personal study and prep stay gitignored-local: `teaching/`, `learn/`, `docs/interview-bank.md`, `docs/blog-moments.md`. They exist only on Antonio's machine — back them up occasionally (they're not in any remote).
- If a step balloons, split the PR rather than letting a branch live for a week: `step/06-relevance-lab` → `step/06a-harness`, `step/06b-lab-ui`.

## Why squash + step branches (the interview answer)

Solo projects rot through formless history. Step branches + squash gives: reviewable units (each PR = one capability), a main where `git log --oneline` literally narrates the roadmap, bisectable history, and PR descriptions that double as documentation. It's trunk-friendly without the noise, and it's the workflow a small product team would actually run.
