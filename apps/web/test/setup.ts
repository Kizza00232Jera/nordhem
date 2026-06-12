import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL only auto-registers cleanup when vitest globals are on; we keep
// globals off, so unmount between tests explicitly.
afterEach(() => {
  cleanup();
});
