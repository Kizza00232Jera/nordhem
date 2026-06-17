import { describe, expect, it } from "vitest";
import { isEditorEmail, studioAccessAllowed } from "../lib/access";

// Step 12: the studio (editor tools, settings) must not be open on a public
// deploy. Access is an email allowlist (ADMIN_EMAILS). The decision is pure, so
// it is tested here; the layout just calls it and redirects.
describe("isEditorEmail", () => {
  it("matches an allowlisted email case- and space-insensitively", () => {
    expect(isEditorEmail("me@x.com", "me@x.com")).toBe(true);
    expect(isEditorEmail("ME@X.com", " me@x.com , other@y.com ")).toBe(true);
  });

  it("rejects non-listed or missing emails", () => {
    expect(isEditorEmail("stranger@z.com", "me@x.com")).toBe(false);
    expect(isEditorEmail(null, "me@x.com")).toBe(false);
    expect(isEditorEmail("me@x.com", "")).toBe(false);
    expect(isEditorEmail("me@x.com", undefined)).toBe(false);
  });
});

describe("studioAccessAllowed", () => {
  it("is open in local development (no friction)", () => {
    expect(studioAccessAllowed(null, { nodeEnv: "development", adminEmails: "" })).toBe(true);
  });

  it("in production, requires an allowlisted editor (fail closed)", () => {
    expect(studioAccessAllowed("me@x.com", { nodeEnv: "production", adminEmails: "me@x.com" })).toBe(true);
    expect(studioAccessAllowed("me@x.com", { nodeEnv: "production", adminEmails: "" })).toBe(false);
    expect(studioAccessAllowed(null, { nodeEnv: "production", adminEmails: "me@x.com" })).toBe(false);
    expect(studioAccessAllowed("stranger@z.com", { nodeEnv: "production", adminEmails: "me@x.com" })).toBe(false);
  });
});
