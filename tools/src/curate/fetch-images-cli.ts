import {
  createDb,
  eq,
  inArray,
  photoPool,
  productsRaw,
  shopProducts,
} from "@nordhem/db";
import { canonicalClass, photoPhrase, planAssignments } from "./images-plan.ts";
import { writeAssignments } from "./images-write.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // fine — key may come from the environment
}

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const accessKey = process.env.UNSPLASH_ACCESS_KEY;
const dryRun = process.argv.includes("--dry-run");

const PER_PAGE = 30;
const MAX_PAGES = 4;

interface UnsplashPhoto {
  urls: { regular: string; small: string };
  user: { name: string; links: { html: string } };
}

async function searchUnsplash(phrase: string, page: number): Promise<UnsplashPhoto[]> {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", phrase);
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("orientation", "squarish");
  url.searchParams.set("content_filter", "high");
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  if (res.status === 403) {
    throw new Error(
      "Unsplash rate limit hit (50/hour on demo keys). The pool is persisted — re-run later to resume where this stopped.",
    );
  }
  if (!res.ok) throw new Error(`Unsplash ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { results: UnsplashPhoto[] };
  return body.results;
}

const { db, close } = createDb(databaseUrl);
try {
  const products = await db
    .select({
      productId: shopProducts.productId,
      category: shopProducts.category,
      productClass: productsRaw.productClass,
    })
    .from(shopProducts)
    .innerJoin(productsRaw, eq(shopProducts.productId, productsRaw.productId));

  const withPhrases = products.map((p) => ({
    productId: p.productId,
    phrase: photoPhrase(canonicalClass(p.productClass ?? "", p.category)),
  }));

  const counts = new Map<string, number>();
  for (const p of withPhrases) counts.set(p.phrase, (counts.get(p.phrase) ?? 0) + 1);

  const phrases = [...counts.keys()].sort();
  const pooled = phrases.length
    ? await db.select().from(photoPool).where(inArray(photoPool.searchQuery, phrases))
    : [];
  const pooledByPhrase = new Map<string, number>();
  for (const photo of pooled) {
    pooledByPhrase.set(photo.searchQuery, (pooledByPhrase.get(photo.searchQuery) ?? 0) + 1);
  }

  let requestsNeeded = 0;
  for (const phrase of phrases) {
    if ((pooledByPhrase.get(phrase) ?? 0) > 0) continue;
    requestsNeeded += Math.min(MAX_PAGES, Math.ceil((counts.get(phrase) ?? 0) / PER_PAGE));
  }
  console.log(
    `${phrases.length} phrases for ${products.length} products; ` +
      `${requestsNeeded} Unsplash requests needed (${phrases.length - [...pooledByPhrase.keys()].length} unpooled)${dryRun ? " — dry run" : ""}`,
  );

  if (dryRun) {
    for (const phrase of phrases) {
      console.log(
        `  ${phrase.padEnd(30)} products=${counts.get(phrase)} pooled=${pooledByPhrase.get(phrase) ?? 0}`,
      );
    }
    process.exit(0);
  }
  if (!accessKey) throw new Error("UNSPLASH_ACCESS_KEY is not set (tools/.env.local)");

  for (const phrase of phrases) {
    if ((pooledByPhrase.get(phrase) ?? 0) > 0) {
      console.log(`  skip "${phrase}" (already pooled)`);
      continue;
    }
    const pages = Math.min(MAX_PAGES, Math.ceil((counts.get(phrase) ?? 0) / PER_PAGE));
    const photos: UnsplashPhoto[] = [];
    for (let page = 1; page <= pages; page++) {
      photos.push(...(await searchUnsplash(phrase, page)));
      await new Promise((r) => setTimeout(r, 300));
    }
    if (photos.length === 0) {
      console.warn(`  WARNING: zero photos for "${phrase}"`);
      continue;
    }
    await db.insert(photoPool).values(
      photos.map((p) => ({
        searchQuery: phrase,
        url: p.urls.regular,
        thumbUrl: p.urls.small,
        photographerName: p.user.name,
        photographerUrl: `${p.user.links.html}?utm_source=nordhem&utm_medium=referral`,
        source: "unsplash",
      })),
    );
    console.log(`  pooled ${photos.length} photos for "${phrase}" (${pages} request${pages > 1 ? "s" : ""})`);
  }

  const fullPool = await db
    .select({ id: photoPool.id, phrase: photoPool.searchQuery })
    .from(photoPool);
  const assignments = planAssignments(withPhrases, fullPool);
  const written = await writeAssignments(db, assignments);
  console.log(`assigned photos to ${written} products (manual swaps preserved)`);
} finally {
  await close();
}
