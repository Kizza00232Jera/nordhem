"use client";

import { useState } from "react";

// The shared demo studio account. These are deliberately public — they exist
// to be printed on the login page so reviewers can open /studio — so they live
// in source, not in env vars. Two rules to keep working:
//   1. DEMO_EMAIL must be listed in ADMIN_EMAILS on the deploy (the studio gate).
//   2. A real account with this exact email + password must be signed up on the
//      live site (the allowlist only lets in accounts that exist).
const DEMO_EMAIL = "demo@nordhem.store";
const DEMO_PASSWORD = "nordhem-demo";

/**
 * Reviewer affordance on the login page: reveals the shared demo credentials
 * that unlock the Search Studio. Hidden behind a reveal so the page reads clean
 * for real shoppers, but one hover (desktop) or tap (touch) shows it — and
 * "Fill the form" drops the values straight into the sign-in inputs.
 */
export function DemoStudioHint() {
  const email = DEMO_EMAIL;
  const password = DEMO_PASSWORD;
  // Two independent triggers: hover reveals on desktop, the button "pins" it
  // open for touch and keyboard (where there is no hover). Keeping them
  // separate means a click never fights the hover state.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const revealed = hovered || pinned;

  function fillForm() {
    // Query the document, not the first <form>: the header search bar is the
    // first form on the page, so scoping to it would miss the login inputs.
    const emailInput = document.querySelector<HTMLInputElement>(
      'input[name="email"]',
    );
    const passwordInput = document.querySelector<HTMLInputElement>(
      'input[name="password"]',
    );
    if (emailInput) {
      // Use the native setter so React's controlled/uncontrolled inputs and any
      // listeners both see the change.
      setNativeValue(emailInput, email);
    }
    if (passwordInput) {
      setNativeValue(passwordInput, password);
    }
    emailInput?.focus();
  }

  return (
    <div
      className="mt-8 rounded-xs border border-line bg-card/60 p-4 text-[13px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">Reviewing this project?</p>
        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          aria-expanded={revealed}
          className="shrink-0 text-pine hover:underline"
        >
          {revealed ? "Hide" : "Demo studio login"}
        </button>
      </div>
      {revealed && (
        <div className="mt-3 space-y-2">
          <p className="text-ink-muted">
            Sign in with these to open the Search Studio (the
            relevance-engineering console under <code>/studio</code>).
          </p>
          <dl className="space-y-1">
            <div className="flex items-baseline gap-2">
              <dt className="w-20 shrink-0 text-ink-muted">Email</dt>
              <dd className="tnum select-all break-all font-medium">{email}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="w-20 shrink-0 text-ink-muted">Password</dt>
              <dd className="tnum select-all break-all font-medium">
                {password}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={fillForm}
            className="mt-1 rounded-xs border border-line px-3 py-1.5 font-medium hover:border-ink"
          >
            Fill the form
          </button>
        </div>
      )}
    </div>
  );
}

/** Set an input's value through React's native setter so onChange still fires. */
function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
