import { redirect } from "next/navigation";
import { studioAccessAllowed } from "../../lib/access";
import { getCurrentUser } from "../../lib/session";

/**
 * Step 12: the studio gate. The storefront is public; these editor tools are
 * not. Open in local development; on a public deploy it requires a logged-in
 * editor whose email is in ADMIN_EMAILS. We REDIRECT rather than render a
 * fallback: a fallback still lets the child page render and ship its data, so
 * a non-editor could read studio data. redirect() makes the response a redirect
 * with no studio body. Anonymous requests are already turned away at the edge by
 * middleware.ts; this also covers logged-in non-editors.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const allowed = studioAccessAllowed(user?.email, {
    nodeEnv: process.env.NODE_ENV,
    adminEmails: process.env.ADMIN_EMAILS,
  });
  if (!allowed) redirect(user ? "/" : "/login");
  return <>{children}</>;
}
