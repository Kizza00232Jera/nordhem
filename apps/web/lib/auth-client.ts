"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Same-origin, so it talks to our
 * /api/auth/* route handler, which sets the session cookie correctly.
 * The login/signup forms call signIn/signUp here, then trigger the
 * server-side guest-cart merge.
 */
export const authClient = createAuthClient();
