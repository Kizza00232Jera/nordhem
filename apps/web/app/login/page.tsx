import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "../components/auth-form";
import { DemoStudioHint } from "../components/demo-studio-hint";
import { googleEnabled } from "../../lib/auth";
import { getCurrentUser } from "../../lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next ?? "/");

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24">
      <div className="mx-auto w-full max-w-sm">
        <AuthForm mode="login" googleEnabled={googleEnabled} next={next ?? "/"} />
        <DemoStudioHint />
      </div>
    </main>
  );
}
