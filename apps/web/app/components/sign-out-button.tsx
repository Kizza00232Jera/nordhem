"use client";

import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className="shrink-0 rounded-xs border border-line px-4 py-2 text-[14px] font-medium hover:border-ink"
    >
      Sign out
    </button>
  );
}
