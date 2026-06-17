import Link from "next/link";
import { studioAccessAllowed } from "../../lib/access";
import { getCurrentUser } from "../../lib/session";

/**
 * Step 12: the studio gate. The storefront is public; these editor tools are
 * not. Open in local development; on a public deploy it requires a logged-in
 * editor whose email is in ADMIN_EMAILS. Wraps every /studio/* route.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const allowed = studioAccessAllowed(user?.email, {
    nodeEnv: process.env.NODE_ENV,
    adminEmails: process.env.ADMIN_EMAILS,
  });

  if (allowed) return <>{children}</>;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-3xl font-light">Editors only</h1>
      <p className="mt-3 text-[14px] text-ink-muted">
        The Search Studio is restricted to editors.{" "}
        {user
          ? "This account is not on the editor list."
          : "Sign in with an editor account to continue."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {!user && (
          <Link
            href="/login"
            className="rounded-xs bg-pine px-4 py-2 text-[14px] font-semibold text-white hover:bg-pine-deep"
          >
            Sign in
          </Link>
        )}
        <Link href="/" className="rounded-xs border border-line px-4 py-2 text-[14px] font-medium hover:border-ink">
          Back to the shop
        </Link>
      </div>
    </main>
  );
}
