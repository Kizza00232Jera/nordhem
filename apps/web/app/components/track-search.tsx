"use client";

import { useEffect, useRef } from "react";
import { track } from "../../lib/track";

/**
 * Fires one search_performed event when a results page renders (Step 10). Lives
 * as an invisible client component the server search page drops in once it has a
 * response, so the event carries the real result count and latency. Deduped by
 * a key so a re-render does not double-count the same search.
 */
export function TrackSearch({
  query,
  mode,
  resultCount,
  latencyMs,
}: {
  query: string;
  mode: "lexical" | "semantic" | "hybrid";
  resultCount: number;
  latencyMs?: number;
}) {
  const fired = useRef("");
  useEffect(() => {
    const key = `${query}|${mode}|${resultCount}`;
    if (fired.current === key) return;
    fired.current = key;
    track({
      type: "search",
      query,
      mode,
      resultCount,
      ...(latencyMs !== undefined && { latencyMs }),
    });
  }, [query, mode, resultCount, latencyMs]);
  return null;
}
