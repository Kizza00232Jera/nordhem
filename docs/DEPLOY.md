# NORDHEM: Deploy runbook

How NORDHEM is actually deployed: Next.js on Vercel, Postgres on Neon, and an optional self-hosted Elasticsearch search service reached over a tunnel. The site is fully usable with only Vercel and Neon (lite mode). The PC and tunnel are what turn on full mode.

This is the operator guide. For the project overview and the local-dev path, see the root `README.md`.

## 1. Vercel + Neon

1. Import the GitHub repo into Vercel.
2. Set **Root Directory = `apps/web`**. The monorepo's workspace packages (`@nordhem/shared`, `@nordhem/db`) are transpiled in place by Next (see `apps/web/next.config.ts`), so no extra build config is needed.
3. Add Postgres through **Vercel Storage** (Neon integration). When prompted for an environment-variable prefix, use **`DATABASE`**. The integration then creates:
   - `DATABASE_URL` is the pooled connection string (what the app uses at runtime).
   - `DATABASE_URL_UNPOOLED` is the direct connection string (use this for migrations and bulk loads).

The app reads `DATABASE_URL` (`apps/web/lib/db.ts`); drizzle-kit also reads `DATABASE_URL` (`packages/db/drizzle.config.ts`).

## 2. Load the catalog into Neon (one time)

The production database needs the catalog and the relevance-lab data. The simplest path is to dump your local Postgres (already loaded per the README) straight into Neon using the **unpooled/direct** URL. Run this locally:

```bash
docker exec nordhem-postgres-1 sh -c \
  "pg_dump -U nordhem -d nordhem --no-owner --no-acl | psql 'DATABASE_URL_UNPOOLED'"
```

Replace `DATABASE_URL_UNPOOLED` with the actual direct connection string from the Neon integration. `--no-owner --no-acl` keeps the dump portable across the role differences between local Postgres and Neon. The container name `nordhem-postgres-1` comes from the compose project name `nordhem` plus the `postgres` service; confirm yours with `docker ps`.

Alternatively, apply the Drizzle migrations against Neon and run the loaders pointed at `DATABASE_URL_UNPOOLED`, but the dump-and-restore above is the fastest one-time path for a demo deploy.

## 3. Environment variables (Vercel, Production)

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Postgres connection. Set automatically by the Neon integration (prefix `DATABASE`). Runtime catalog, auth, cart, orders, analytics. |
| `DATABASE_URL_UNPOOLED` | Yes (ops) | Direct Postgres connection from the integration. Used for the one-time load and for migrations, not by the running app. |
| `BETTER_AUTH_SECRET` | Yes | Signs sessions. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `BETTER_AUTH_URL` | Yes | Your production origin, e.g. `https://nordhem.vercel.app`. Must match the deployed domain or auth redirects break. |
| `ADMIN_EMAILS` | Yes (for studio) | Comma-separated editor allowlist. Sign up with one of these emails to reach `/studio` in production. If unset, the studio is locked for everyone. |
| `SEARCH_API_URL` | Optional | The tunnel URL of the self-hosted search service. Unset means the site runs in lite mode. |
| `SEARCH_API_TOKEN` | Optional | Shared bearer token guarding the tunnelled search service. Must match the token the PC service runs with. |
| `CHAT_API_KEY` | Optional | Enables the shopping chatbot via an OpenAI-compatible provider. Leave blank to hide it. Can also be configured in `/studio/settings` instead. |
| `CHAT_BASE_URL` | Optional | The provider's `/v1` base URL (default `https://api.openai.com/v1`; Anthropic is `https://api.anthropic.com/v1`). |
| `CHAT_MODEL` | Optional | The chat model id, e.g. `gpt-4o-mini` or `claude-haiku-4-5`. |
| `CHAT_PROVIDER` | Optional | Provider hint for the chatbot backend. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional | PostHog product analytics. Analytics simply stay off without it. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional | PostHog host, `https://eu.i.posthog.com`. |
| `GOOGLE_CLIENT_ID` | Optional | Enables the Google sign-in button. Needs the production OAuth callback registered. |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth secret. Both must be present or the Google button stays hidden. |

Notes:
- `NEXT_PUBLIC_*` variables are baked in at **build time**, so changing them requires a redeploy to take effect.
- Email + password auth always works; Google is env-gated and hidden when its credentials are absent.
- For Google in production, register the callback `https://YOUR-DOMAIN/api/auth/callback/google` in the Google Cloud Console.
- Preview deploys can sign in too: `buildAuth` trusts `VERCEL_URL` automatically in addition to `BETTER_AUTH_URL`.

## 4. Modes (lite vs full)

With just Vercel + Neon, the site runs in **lite mode**: search falls back to Postgres full-text search (OR semantics, recall-favouring) over the shop catalog. There are no facets, synonyms, or semantic ranking in this mode, and the UI says so.

To turn on **full mode**, run the Elasticsearch-backed search service somewhere and point Vercel at it:

1. On the host machine, bring up the stack and the service (see the README's local setup), so Fastify is listening on `http://localhost:3001`.
2. Choose a tunnel:
   - Quick: `pnpm -F @nordhem/search tunnel` (a Cloudflare quick tunnel to localhost:3001, prints an https URL).
   - Stable: a Cloudflare **named tunnel** mapping a fixed hostname to `http://localhost:3001`.
3. Set a shared token on both sides:
   - On the PC service: run it with `SEARCH_API_TOKEN` set (the Fastify service requires a matching `Bearer` token on every route except `/health`).
   - On Vercel: set `SEARCH_API_TOKEN` to the same value and `SEARCH_API_URL` to the tunnel URL.

The circuit breaker (800ms timeout, opens after 2 consecutive failures, half-open probe after a 10s cooldown) then prefers the tunnel and falls back to lite mode automatically whenever the PC is unreachable.

## 5. Studio access (RBAC)

`/studio` is open in local development (no login friction while building) and locked in production. In production, access requires a signed-in user whose email is in `ADMIN_EMAILS` (comma-separated, case- and space-insensitive). The gate fails closed: if `ADMIN_EMAILS` is unset, nobody gets in. To grant yourself access, set `ADMIN_EMAILS` to your email on Vercel and sign up on the live site with that exact email. No schema change is involved.

## 6. Bring your own engine (per visitor)

Because the self-hosted PC is not always on, a visitor can drive the live site from their own machine for the duration of their session, without any deploy access:

1. Clone the repo and run the search service locally (README local setup).
2. Expose it: `pnpm -F @nordhem/search tunnel` (or a named Cloudflare tunnel) to get an https URL.
3. Visit `/status` on the live site, paste the tunnel URL and the shared password, and connect.

This stores a per-session engine override in an https-only cookie (`{url, token}`), validated to be a well-formed https URL. Only that visitor's session is affected, which is why a shared password is acceptable. The override is read per request and routed through the same circuit breaker as the default engine.

## 7. Troubleshooting

- **Build fails**: check `DATABASE_URL` is present (the Neon integration sets it with prefix `DATABASE`) and that the Root Directory is `apps/web`.
- **Auth redirect loop**: `BETTER_AUTH_URL` must exactly match the deployed domain (scheme and host).
- **Studio shows "Editors only" / locked**: add your email to `ADMIN_EMAILS` on Vercel and sign up with that exact email.
- **Search is always lite**: confirm the tunnel is up, `SEARCH_API_URL` points at it, and `SEARCH_API_TOKEN` matches the value the PC service is running with. Check `/status` and the service's `/health`.
- **Chatbot missing**: it is hidden unless configured. Set `CHAT_API_KEY` (and base URL / model) or configure it in `/studio/settings`. It is also hidden in lite mode.
- **Google button missing**: both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be set, with the production callback registered. Email + password works regardless.
