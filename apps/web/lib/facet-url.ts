/**
 * Pure querystring helpers for facet state. NORDHEM keeps all filter, sort
 * and page state in the URL (shareable, back/forward-friendly, works before
 * JavaScript loads — D37). Each function takes the current querystring and
 * returns a new one; it never mutates global state.
 *
 * Changing any filter or the sort resets to page 1, because the page the
 * shopper was on may not exist once the result set is narrowed or reordered.
 * Pagination itself (goToPage) deliberately preserves everything.
 */

/** Toggle one value in a repeated multi-value param (OR within a facet). */
export function toggleListParam(
  current: string,
  key: string,
  value: string,
): string {
  const params = new URLSearchParams(current);
  const existing = params.getAll(key);
  params.delete(key);
  const next = existing.includes(value)
    ? existing.filter((v) => v !== value)
    : [...existing, value];
  for (const v of next) params.append(key, v);
  params.delete("page");
  return params.toString();
}

/** Set a single-value param, or clear it when value is null/empty. */
export function setSingleParam(
  current: string,
  key: string,
  value: string | null,
): string {
  const params = new URLSearchParams(current);
  if (value === null || value === "") params.delete(key);
  else params.set(key, value);
  params.delete("page");
  return params.toString();
}

/** Move to a page, preserving all filters and sort (no reset). */
export function goToPage(current: string, page: number): string {
  const params = new URLSearchParams(current);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  return params.toString();
}
