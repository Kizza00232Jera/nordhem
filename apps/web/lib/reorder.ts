/**
 * Immutable list-reordering helpers. The curations pin list IS the search order
 * (index 0 renders at result #1), and the editor lets you reorder it by arrow
 * buttons (accessible, keyboard) and by drag-and-drop (pointer); both go through
 * these, so the order logic stays pure and tested instead of buried in the UI.
 */

/** Move the item at `from` to `to`, shifting the rest. No-op (same ref) if the
 * move is trivial or out of bounds. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr;
  }
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** Swap the item at `index` with the one above it (toward result #1). */
export function moveUp<T>(arr: T[], index: number): T[] {
  return moveItem(arr, index, index - 1);
}

/** Swap the item at `index` with the one below it. */
export function moveDown<T>(arr: T[], index: number): T[] {
  return moveItem(arr, index, index + 1);
}

/**
 * Move `dragId` so it lands just before/after `targetId`. Used by drag-and-drop:
 * the hovered row is the target, and the cursor's half (above/below its midpoint)
 * picks `place`, so the same call drives both the live drop-placeholder preview
 * and the committed order. No-op (same ref) if either id is missing or the drag
 * id is the target.
 */
export function reorderByTarget<T>(
  arr: T[],
  dragId: T,
  targetId: T,
  place: "before" | "after",
): T[] {
  if (dragId === targetId) return arr;
  if (!arr.includes(dragId) || !arr.includes(targetId)) return arr;
  const without = arr.filter((x) => x !== dragId);
  const idx = without.indexOf(targetId) + (place === "after" ? 1 : 0);
  return [...without.slice(0, idx), dragId, ...without.slice(idx)];
}
