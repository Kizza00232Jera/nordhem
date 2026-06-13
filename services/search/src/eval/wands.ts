/**
 * Parsers for the WANDS evaluation files (tab-separated, despite the .csv
 * name, like product.csv). query.csv holds the 480 queries; label.csv holds
 * the ~233k human relevance judgments. We map each label to a numeric grade
 * for the metrics: Exact=2, Partial=1, Irrelevant=0.
 */

export interface RawQuery {
  queryId: number;
  query: string;
  queryClass: string | null;
}

export interface RawJudgment {
  queryId: number;
  productId: number;
  grade: number;
}

const GRADES: Record<string, number> = {
  Exact: 2,
  Partial: 1,
  Irrelevant: 0,
};

export function labelToGrade(label: string): number {
  const grade = GRADES[label];
  if (grade === undefined) {
    throw new Error(`Unknown WANDS relevance label: "${label}"`);
  }
  return grade;
}

/**
 * Collapse duplicate (queryId, productId) judgments to one row, keeping the
 * highest grade (WANDS ships a handful of duplicated pairs, sometimes with
 * different labels). First-seen order is preserved.
 */
export function dedupeJudgments(judgments: RawJudgment[]): RawJudgment[] {
  const byPair = new Map<string, RawJudgment>();
  for (const j of judgments) {
    const key = `${j.queryId}:${j.productId}`;
    const existing = byPair.get(key);
    if (!existing || j.grade > existing.grade) byPair.set(key, j);
  }
  return [...byPair.values()];
}

function rows(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim() !== "");
}

function checkHeader(actual: string[], expected: string[]): void {
  if (expected.some((col, i) => actual[i] !== col)) {
    throw new Error(
      `Unexpected WANDS header: ${JSON.stringify(actual)} — the dataset format changed.`,
    );
  }
}

export function parseQueriesTsv(content: string): RawQuery[] {
  const lines = rows(content);
  checkHeader(lines[0]?.split("\t") ?? [], ["query_id", "query", "query_class"]);
  return lines.slice(1).map((line) => {
    const [id, query, queryClass] = line.split("\t");
    return {
      queryId: Number(id),
      query: query ?? "",
      queryClass: queryClass === undefined || queryClass === "" ? null : queryClass,
    };
  });
}

export function parseLabelsTsv(content: string): RawJudgment[] {
  const lines = rows(content);
  checkHeader(lines[0]?.split("\t") ?? [], ["id", "query_id", "product_id", "label"]);
  return lines.slice(1).map((line) => {
    const [, queryId, productId, label] = line.split("\t");
    return {
      queryId: Number(queryId),
      productId: Number(productId),
      grade: labelToGrade(label ?? ""),
    };
  });
}
