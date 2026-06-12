export interface MarkedSegment {
  text: string;
  marked: boolean;
}

/**
 * Splits an engine-highlighted string ("plush <mark>velvet</mark> chair")
 * into renderable segments. The engine inserts tags into UNESCAPED source
 * text, so the UI must never hand it to innerHTML — it renders these
 * segments as React elements instead.
 */
export function splitMarked(highlighted: string): MarkedSegment[] {
  const segments: MarkedSegment[] = [];
  for (const part of highlighted.split("<mark>")) {
    const closeAt = part.indexOf("</mark>");
    if (closeAt === -1) {
      if (part.length > 0) segments.push({ text: part, marked: false });
      continue;
    }
    segments.push({ text: part.slice(0, closeAt), marked: true });
    const rest = part.slice(closeAt + "</mark>".length);
    if (rest.length > 0) segments.push({ text: rest, marked: false });
  }
  return segments;
}
