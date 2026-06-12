import posthog from "posthog-js";

// Product analytics only (D14): sessions, funnels, autocapture. Search
// telemetry that feeds ranking is first-party in Postgres (step 10).
// The PostHog project is shared with the portfolio (free tier allows one),
// so every NORDHEM event carries a `project` super property — filter or
// break down by it (or by $host) in the PostHog UI.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    defaults: "2025-05-24",
  });
  posthog.register({ project: "nordhem" });
}
