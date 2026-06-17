import { getCurrentUser } from "./session";

/**
 * Step 12 access control for the studio. The storefront is public; the editor
 * tools, relevance lab, analytics, and settings are not. Access is an email
 * allowlist set via the ADMIN_EMAILS env var (comma-separated), so you grant
 * yourself by signing up with that email and adding it on Vercel. No schema
 * change, and it fails CLOSED on a public deploy.
 */

/** Is `email` in the comma-separated allowlist? Case- and space-insensitive. */
export function isEditorEmail(
  email: string | null | undefined,
  adminEmailsCsv: string | undefined,
): boolean {
  if (!email) return false;
  const allow = (adminEmailsCsv ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}

/**
 * The studio gate. Open in local development (no login friction while building);
 * in production it requires an allowlisted editor, and if ADMIN_EMAILS is unset
 * it locks everyone out rather than exposing the tools.
 */
export function studioAccessAllowed(
  email: string | null | undefined,
  env: { nodeEnv: string | undefined; adminEmails: string | undefined },
): boolean {
  if (env.nodeEnv !== "production") return true;
  return isEditorEmail(email, env.adminEmails);
}

/** Server helper: does the current request belong to a studio editor? */
export async function currentUserCanEditStudio(): Promise<boolean> {
  const user = await getCurrentUser();
  return studioAccessAllowed(user?.email, {
    nodeEnv: process.env.NODE_ENV,
    adminEmails: process.env.ADMIN_EMAILS,
  });
}
