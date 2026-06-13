import { headers } from "next/headers";
import { auth } from "./auth";

/**
 * The current shopper, or null for a guest. Reads the session cookie from the
 * incoming request headers (a request-time API, so callers become dynamic).
 * One seam for every Server Component, Server Action, and route that needs to
 * know who is logged in.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentUser() {
  const result = await getSession();
  return result?.user ?? null;
}
