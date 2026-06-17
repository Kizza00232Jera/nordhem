import { SearchResponseSchema, type SearchResponse } from "@nordhem/shared";
import { cookies } from "next/headers";
import { CircuitBreaker } from "./circuit-breaker";
import { db } from "./db";
import { type EngineBackend, ENGINE_COOKIE, parseEngineCookie } from "./engine-cookie";
import { ftsSearchShop, type FtsParams } from "./fts-search";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";
const SEARCH_API_TOKEN = process.env.SEARCH_API_TOKEN;
// A sleeping PC must not hold a request hostage (D12).
const TIMEOUT_MS = 800;

/**
 * The search backend for THIS request: a per-session connected engine (Step 12
 * bring-your-own-engine) if the visitor set one, else the configured default.
 * cookies() only works in a request scope; outside one we use the default.
 */
export async function getSearchBackend(): Promise<EngineBackend> {
  try {
    const override = parseEngineCookie((await cookies()).get(ENGINE_COOKIE)?.value);
    if (override) return override;
  } catch {
    // not in a request scope
  }
  return { url: SEARCH_API_URL, ...(SEARCH_API_TOKEN ? { token: SEARCH_API_TOKEN } : {}) };
}

function authHeaders(backend: EngineBackend): Record<string, string> {
  return backend.token ? { authorization: `Bearer ${backend.token}` } : {};
}

export interface ResolveDeps {
  breaker: CircuitBreaker;
  full: () => Promise<SearchResponse>;
  fallback: () => Promise<SearchResponse>;
}

/**
 * The breaker-guarded retrieval policy: try the full Elasticsearch service; on
 * any failure record it and serve the Postgres fallback; and while the breaker
 * is open, skip the service entirely and go straight to the fallback. Returns
 * the response plus whether it came from lite mode.
 */
export async function resolveSearch(
  deps: ResolveDeps,
): Promise<{ response: SearchResponse; lite: boolean }> {
  if (deps.breaker.canRequest()) {
    try {
      const response = await deps.full();
      deps.breaker.recordSuccess();
      return { response, lite: false };
    } catch {
      deps.breaker.recordFailure();
    }
  }
  return { response: await deps.fallback(), lite: true };
}

// One breaker per server process, surviving Next dev HMR via globalThis.
const globalForBreaker = globalThis as unknown as { __nordhemBreaker?: CircuitBreaker };
export function searchBreaker(): CircuitBreaker {
  return (globalForBreaker.__nordhemBreaker ??= new CircuitBreaker({
    failureThreshold: 2,
    cooldownMs: 10_000,
  }));
}

/**
 * Shop search with automatic lite-mode fallback. `queryString` is the already
 * built service querystring (scope/size/mode/filters); the fallback ignores the
 * full-mode-only parts and runs a plain FTS with the same paging.
 */
export async function searchShopWithFallback(
  query: string,
  queryString: string,
  fts: FtsParams,
): Promise<{ response: SearchResponse; lite: boolean }> {
  const backend = await getSearchBackend();
  const full = async (): Promise<SearchResponse> => {
    const res = await fetch(`${backend.url}/search?${queryString}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: authHeaders(backend),
    });
    if (!res.ok) throw new Error(`search service responded ${res.status}`);
    return SearchResponseSchema.parse(await res.json());
  };
  const fallback = () => ftsSearchShop(db(), query, fts);
  return resolveSearch({ breaker: searchBreaker(), full, fallback });
}

/** Probe the active search backend for the status page (does not affect the breaker). */
export async function searchServiceHealthy(): Promise<boolean> {
  try {
    const backend = await getSearchBackend();
    const res = await fetch(`${backend.url}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
}
