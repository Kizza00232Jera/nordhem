"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mergeGuestCartAfterLoginAction } from "../actions/auth";
import { authClient } from "../../lib/auth-client";

type Mode = "login" | "signup";

/**
 * Email+password auth form (login or signup). Auth itself goes through the
 * Better Auth browser client (which sets the session cookie via our route
 * handler); on success we fold any guest cart into the account (D43) and move
 * on. The Google button only renders when the server says it is configured.
 */
export function AuthForm({
  mode,
  googleEnabled,
  next = "/",
}: {
  mode: Mode;
  googleEnabled: boolean;
  next?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const name = String(form.get("name") ?? "");

    const result =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Please try again.");
      setPending(false);
      return;
    }

    await mergeGuestCartAfterLoginAction();
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-display text-4xl font-light">
        {mode === "signup" ? "Create account" : "Sign in"}
      </h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        {mode === "signup"
          ? "One account for your cart, orders and favorites."
          : "Welcome back to NORDHEM."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <Field label="Name" name="name" type="text" autoComplete="name" required />
        )}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          required
        />

        {error && (
          <p role="alert" className="text-[14px] text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xs bg-pine py-3 text-[15px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
        >
          {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      {googleEnabled && (
        <button
          type="button"
          onClick={() =>
            authClient.signIn.social({ provider: "google", callbackURL: next })
          }
          className="mt-3 w-full rounded-xs border border-line py-3 text-[15px] font-medium hover:border-ink"
        >
          Continue with Google
        </button>
      )}

      <p className="mt-6 text-center text-[14px] text-ink-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-pine hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to NORDHEM?{" "}
            <Link href="/signup" className="text-pine hover:underline">
              Create account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium">{label}</span>
      <input
        name={name}
        {...props}
        className="h-11 w-full rounded-xs border border-line bg-card px-3.5 text-[15px]"
      />
    </label>
  );
}
