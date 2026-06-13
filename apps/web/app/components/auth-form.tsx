"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  signInAction,
  signUpAction,
  type AccountState,
} from "../actions/account";
import { authClient } from "../../lib/auth-client";

type Mode = "login" | "signup";

/**
 * Email+password auth form. Submits to a Server Action (signUp/signIn), so it
 * works before hydration and without JS — the action sets the session cookie
 * and folds in the guest cart. The Google button is the one client-only bit
 * and only renders when the server says Google is configured.
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
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AccountState, FormData>(
    action,
    {},
  );

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

      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <Field label="Name" name="name" type="text" autoComplete="name" required />
        )}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          required
        />

        {state.error && (
          <p role="alert" className="text-[14px] text-error">
            {state.error}
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
