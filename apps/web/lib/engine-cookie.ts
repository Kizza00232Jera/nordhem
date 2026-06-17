/**
 * Step 12 bring-your-own-engine. A visitor can point the deployed storefront at
 * THEIR own tunnelled search service, for their session only, by storing an
 * {url, token} override in this cookie. Per-session means one visitor's choice
 * never affects anyone else, so a shared password is safe enough. https-only.
 */
export const ENGINE_COOKIE = "nordhem_engine";

export interface EngineBackend {
  url: string;
  token?: string;
}

/** Only well-formed https URLs are accepted as an override target. */
export function isValidEngineUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Parse the cookie value into a backend, or null if missing/invalid. */
export function parseEngineCookie(raw: string | undefined | null): EngineBackend | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { url?: unknown; token?: unknown };
    if (typeof o.url === "string" && isValidEngineUrl(o.url)) {
      return {
        url: o.url.replace(/\/+$/, ""),
        ...(typeof o.token === "string" && o.token ? { token: o.token } : {}),
      };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Serialise an override for the cookie (trims + strips trailing slash). */
export function serializeEngine(url: string, token: string): string {
  return JSON.stringify({ url: url.trim().replace(/\/+$/, ""), token: token.trim() });
}
