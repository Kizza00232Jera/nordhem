import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Every Better Auth endpoint (sign-up, sign-in, sign-out, session, OAuth
// callback) is served under /api/auth/* by this one catch-all handler.
export const { GET, POST } = toNextJsHandler(auth);
