import { account, session, user, verification, type Db } from "@nordhem/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { mergeGuestCartForUser } from "./guest-cart-merge";

/**
 * Better Auth (D42). Users live in our own Postgres — the "retailer owns its
 * customer data" pattern — via the Drizzle adapter over the shared db()
 * singleton. Email+password is always on. Google is env-gated: with no
 * GOOGLE_CLIENT_ID a fresh clone and CI never need secrets, and the storefront
 * simply hides the Google button (see the login UI).
 *
 * buildAuth() takes the db explicitly so the integration tests can point a
 * real Testcontainers Postgres at the exact same config the app runs.
 */
export function buildAuth(database: Db) {
  const googleConfigured =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  // Origins allowed to use auth. baseURL covers the real domain; VERCEL_URL
  // (auto-set per deployment) lets preview deploys sign in too.
  const trustedOrigins = [baseURL];
  if (process.env.VERCEL_URL) trustedOrigins.push(`https://${process.env.VERCEL_URL}`);

  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET ?? "nordhem-dev-secret-change-me",
    baseURL,
    trustedOrigins,
    database: drizzleAdapter(database, {
      provider: "pg",
      // Our table variables are named for Better Auth's models, but pass them
      // explicitly so the adapter never has to guess.
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true },
    // Fires on every new session (email/password AND Google), so the guest
    // cart merges into the account no matter how the shopper signs in.
    databaseHooks: {
      session: {
        create: {
          after: async (newSession: { userId: string }) => {
            await mergeGuestCartForUser(newSession.userId);
          },
        },
      },
    },
    socialProviders: googleConfigured
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : undefined,
    // Must be last: lets Server Actions set the session cookie on the response.
    plugins: [nextCookies()],
  });
}

export const auth = buildAuth(db());

/** Whether the live Google button should render (creds present in env). */
export const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
