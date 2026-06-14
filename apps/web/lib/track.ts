import type { SearchEventInput } from "@nordhem/shared";

const ENDPOINT = "/api/events";

/** 1-based global rank of a result given the page it sits on. */
export function clickPosition(page: number, indexOnPage: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * pageSize + indexOnPage + 1;
}

/** The beacon payload for an event (extracted so it can be unit-tested). */
export function eventBeaconBody(event: SearchEventInput): string {
  return JSON.stringify(event);
}

/**
 * Fire one telemetry event, best-effort. Prefers `sendBeacon` so the request
 * survives the navigation a result click triggers; falls back to `fetch` with
 * `keepalive` when sendBeacon is unavailable or refuses the payload. Never
 * throws, and is a no-op during SSR.
 */
export function track(event: SearchEventInput): void {
  if (typeof navigator === "undefined") return;
  const body = eventBeaconBody(event);
  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort: telemetry must never disturb the shopper.
  }
}
