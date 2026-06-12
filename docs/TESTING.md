# NORDHEM — Testing Constitution

Referenced from CLAUDE.md. Read before writing code in any step. The TDD *loop* itself is driven by the global `tdd` skill (vertical tracer bullets: ONE test → ONE implementation → repeat; never all-tests-then-all-code). This file defines what deserves tests, what doesn't, the infrastructure, and the honesty rules.

## Inherited from even-steven (Antonio's proven habits — keep)

- Specific assertions on real values (`expect(format(1234.56, "USD")).toBe("$1 234.56")`), never `toBeDefined()` padding.
- Fixture builders with overrides (the `makeClient()` pattern) instead of copy-pasted setup.
- Edge cases that hurt: float drift, empty sets, cycles. Here: empty queries, zero-result queries, diacritics ("hyggekrog"), tied scores, missing judgments, ES timeout mid-request.
- Behavior through public interfaces, not implementation details (even-steven's `docs/testing-strategy.md` philosophy — same as the tdd skill's).

## Upgrades for this project (the gaps found in the analysis)

- **Vitest** (not Jest) — TS-native, fast, one config per package.
- **Real engines in integration tests via Testcontainers** — spin real Elasticsearch and Postgres containers in tests. Search behavior (analyzers, fuzziness, synonyms, RRF) CANNOT be honestly tested against mocks.
- **Playwright e2e** for golden flows.
- **CI from step 1** (GitHub Actions): typecheck + unit on every PR; integration + build before merge. No `--passWithNoTests` anywhere — an empty suite is a failure, not a pass.
- Coverage reported as a signal, never chased as a target.

## What gets tests (the matrix)

**`services/search` — the crown jewel, strictest TDD.**
- Pure logic, unit-tested with hand-computed fixtures: eval metrics (nDCG/MRR/recall — the expected values in fixtures are computed BY HAND in a comment, that's the proof), RRF fusion arithmetic, query-builder output (params → exact ES query DSL JSON), click-boost capping + position-bias normalization, circuit-breaker state machine.
- Integration (Testcontainers ES): index 20-50 fixture products → assert real behaviors: "querry chair" finds chairs (fuzziness), "sofa" finds couch-labeled products (synonym), curated pin appears first, filters don't affect scoring, `_explain` returns parseable structure.
- Integration (Testcontainers PG): Drizzle queries, the Postgres FTS fallback returns sane results, config change-history writes.

**`apps/web` — logic only, not pixels.**
- Vitest + React Testing Library: search combobox keyboard navigation (arrows/enter/escape/focus trap), facet state reducers, cart logic (add/merge-on-login/optimistic update + rollback), URL state sync.
- Server logic: circuit-breaker fallback decision (search service down → FTS path → response tagged `mode: fallback`).

**`packages/shared`** — contract tests: API response schemas parse real fixture payloads; a contract change must break a test before it breaks the app.

**e2e (Playwright, golden flows only):** search → click result → PDP → add to cart → checkout → order visible in history; favorites toggle persists across reload; lite-mode banner appears when search service env points nowhere; studio: run eval on tiny fixture set → scores render. Plus an axe accessibility scan on home/PLP/PDP.

**No tests for:** styling/markup-only components, Next.js page shells without logic, third-party internals (Better Auth, PostHog), one-shot tools (`tools/` get a `--dry-run` smoke test only).

## Honesty rules (non-negotiable — this is the anti-fake-green contract)

1. **RED must be witnessed.** Run the new test, show the failure output in chat, THEN implement. A test that passes on first run is suspect: either the behavior already exists (delete the test or sharpen it) or the test asserts nothing.
2. **Never mock the system under test.** Mock only true externals (Unsplash API, Anthropic API). ES and PG are not mocked in integration tests — that's what Testcontainers is for.
3. **Never weaken an assertion to get green.** If a test fails unexpectedly, the next move is understanding, not editing the expectation. Changing an expected value requires saying out loud WHY the new value is correct.
4. **Expected values come from outside the code.** Metric fixtures are hand-computed; query-DSL expectations are written from the ES docs, not pasted from the function's own output. Pasting actual output into the expectation = testing that the code does what the code does.
5. **Green is reported with evidence**: the test run summary (X passed, Y files, duration) gets quoted in chat, and failures are never summarized as "minor issues".
6. **A flaky test is a bug** — fix or delete the same day, never retry-until-green.

## Definition of done (enforced by wrap-step)

`pnpm -r typecheck && pnpm -r test` green, integration suite green if the step touched search/db behavior, e2e green if it touched a golden flow, and the step's new logic has tests at the right layer per the matrix above.
