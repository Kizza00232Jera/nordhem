"use server";

import { logChange } from "../../lib/change-log-repo";
import {
  cardsByIds,
  getCuration,
  saveCuration,
  type CurationData,
  type ProductCard,
} from "../../lib/curations-repo";

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:3001";

export async function getCurationAction(query: string): Promise<CurationData> {
  return getCuration(query);
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveCurationAction(query: string, data: CurationData): Promise<SaveResult> {
  if (!query.trim()) return { ok: false, error: "Enter a query to curate." };
  await saveCuration(query, data);
  const summary =
    data.pinned.length === 0 && data.hidden.length === 0
      ? `Cleared curation for "${query.trim()}"`
      : `Curated "${query.trim()}": ${data.pinned.length} pinned, ${data.hidden.length} hidden`;
  await logChange("curation", "update", summary, data);
  return { ok: true };
}

export async function cardsByIdsAction(ids: number[]): Promise<ProductCard[]> {
  return cardsByIds(ids);
}

interface ApiHit {
  id: string;
  name: string;
  priceCents?: number;
  imageThumbUrl?: string | null;
  slug?: string;
}

/** Run a shop search for the editor: the baseline list and the pin picker. */
export async function searchShopAction(query: string): Promise<ProductCard[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `${SEARCH_API_URL}/search?q=${encodeURIComponent(q)}&scope=shop&size=20&mode=lexical`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { hits?: ApiHit[] };
    return (data.hits ?? []).map((h) => ({
      id: Number(h.id),
      name: h.name,
      slug: h.slug ?? null,
      priceCents: h.priceCents ?? null,
      imageThumbUrl: h.imageThumbUrl ?? null,
    }));
  } catch {
    return [];
  }
}
