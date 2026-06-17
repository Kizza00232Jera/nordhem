import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Step 12 security. Block anonymous access to /studio AT THE EDGE, before any
 * page renders. A layout that only renders a fallback does not stop the child
 * page from rendering and shipping its data in the RSC payload, so an
 * unauthenticated request could leak studio data. This cheap cookie-presence
 * check (no DB) stops that; the fine-grained editor-allowlist check still runs
 * in the studio layout for logged-in users.
 */
export function middleware(request: NextRequest) {
  // Studio is open in local development (no login friction); gated in production.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const session = getSessionCookie(request);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/studio/:path*"] };
