import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const toolsDir = path.resolve(import.meta.dirname, "..");

// One-shot tool → --dry-run smoke test only (docs/TESTING.md matrix).
describe("download-wands --dry-run", () => {
  it("plans all three WANDS files into data/wands without touching the network", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "src/download-wands.ts", "--dry-run"],
      { cwd: toolsDir },
    );

    for (const file of ["product.csv", "query.csv", "label.csv"]) {
      expect(stdout).toContain(file);
    }
    expect(stdout).toMatch(/data[\\/]wands/);
    expect(stdout).not.toContain("downloaded");
  });
});
