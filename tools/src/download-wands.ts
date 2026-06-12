import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

/**
 * Downloads the WANDS dataset (github.com/wayfair/WANDS) into data/wands/.
 * The CSVs are gitignored; this tool is the committed, reproducible path
 * to them. Idempotent: existing non-empty files are skipped.
 */
const BASE_URL = "https://raw.githubusercontent.com/wayfair/WANDS/main/dataset";
const FILES = ["product.csv", "query.csv", "label.csv"] as const;

const targetDir = path.resolve(import.meta.dirname, "../../data/wands");
const dryRun = process.argv.includes("--dry-run");

console.log(`WANDS dataset -> ${targetDir}${dryRun ? " (dry run)" : ""}`);

for (const file of FILES) {
  const dest = path.join(targetDir, file);
  const alreadyThere = await stat(dest).then(
    (s) => s.size > 0,
    () => false,
  );

  if (alreadyThere) {
    console.log(`  skip ${file} (already present)`);
    continue;
  }
  if (dryRun) {
    console.log(`  would fetch ${BASE_URL}/${file} -> ${dest}`);
    continue;
  }

  await mkdir(targetDir, { recursive: true });
  const res = await fetch(`${BASE_URL}/${file}`);
  if (!res.ok || res.body === null) {
    throw new Error(`GET ${BASE_URL}/${file} failed: ${res.status} ${res.statusText}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as unknown as NodeReadableStream),
    createWriteStream(dest),
  );
  const { size } = await stat(dest);
  console.log(`  downloaded ${file} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}
