import { describe, expect, it } from "vitest";
import { dedupeJudgments, labelToGrade, parseLabelsTsv, parseQueriesTsv } from "../../src/eval/wands.ts";

// WANDS ships two more tab-separated files (despite the .csv name): query.csv
// (query_id, query, query_class) and label.csv (id, query_id, product_id,
// label) where label is Exact / Partial / Irrelevant. We parse and map the
// label to a numeric grade for the metrics.
describe("labelToGrade", () => {
  it("maps the three WANDS labels to graded relevance", () => {
    expect(labelToGrade("Exact")).toBe(2);
    expect(labelToGrade("Partial")).toBe(1);
    expect(labelToGrade("Irrelevant")).toBe(0);
  });

  it("throws on an unknown label rather than guessing", () => {
    expect(() => labelToGrade("Sortof")).toThrow();
  });
});

describe("parseQueriesTsv", () => {
  it("reads the 480-query file shape", () => {
    const tsv = "query_id\tquery\tquery_class\n0\tsalon chair\tMassage Chairs\n1\tsmart coffee table\tCoffee & Cocktail Tables\n";
    expect(parseQueriesTsv(tsv)).toEqual([
      { queryId: 0, query: "salon chair", queryClass: "Massage Chairs" },
      { queryId: 1, query: "smart coffee table", queryClass: "Coffee & Cocktail Tables" },
    ]);
  });

  it("rejects a file whose header changed", () => {
    expect(() => parseQueriesTsv("q_id\tq\n0\tchair\n")).toThrow();
  });
});

describe("dedupeJudgments", () => {
  // WANDS contains duplicate (query, product) judgment rows. We keep one per
  // pair, taking the highest grade (conservative toward relevance), in
  // first-seen order.
  it("collapses a duplicated pair to its highest grade", () => {
    expect(
      dedupeJudgments([
        { queryId: 87, productId: 41180, grade: 1 },
        { queryId: 87, productId: 41180, grade: 2 },
      ]),
    ).toEqual([{ queryId: 87, productId: 41180, grade: 2 }]);
  });

  it("leaves distinct pairs untouched and in order", () => {
    const input = [
      { queryId: 0, productId: 5, grade: 2 },
      { queryId: 0, productId: 6, grade: 0 },
      { queryId: 1, productId: 5, grade: 1 },
    ];
    expect(dedupeJudgments(input)).toEqual(input);
  });
});

describe("parseLabelsTsv", () => {
  it("reads judgments and maps the label to a grade", () => {
    const tsv = "id\tquery_id\tproduct_id\tlabel\n0\t0\t25434\tExact\n1\t0\t12088\tIrrelevant\n2\t1\t999\tPartial\n";
    expect(parseLabelsTsv(tsv)).toEqual([
      { queryId: 0, productId: 25434, grade: 2 },
      { queryId: 0, productId: 12088, grade: 0 },
      { queryId: 1, productId: 999, grade: 1 },
    ]);
  });
});
