"use server";

import { cookies } from "next/headers";
import { ENGINE_COOKIE, isValidEngineUrl, serializeEngine } from "../../lib/engine-cookie";

/**
 * Step 12 bring-your-own-engine. A visitor connects their own tunnelled search
 * service to the deployed storefront for THEIR session (an httpOnly cookie), so
 * they can see full mode without the host PC being on. Per-session: it only
 * affects this browser, never anyone else.
 */
export type EngineResult = { ok: true; message: string } | { ok: false; error: string };

export async function connectEngineAction(url: string, token: string): Promise<EngineResult> {
  const u = url.trim();
  if (!isValidEngineUrl(u)) {
    return { ok: false, error: "Enter a valid https tunnel URL (e.g. https://something.trycloudflare.com)." };
  }
  (await cookies()).set(ENGINE_COOKIE, serializeEngine(u, token), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return { ok: true, message: "Connected. This browser now searches through your engine (full mode)." };
}

export async function disconnectEngineAction(): Promise<EngineResult> {
  (await cookies()).delete(ENGINE_COOKIE);
  return { ok: true, message: "Disconnected. Back to the default search (lite mode if the host is offline)." };
}
