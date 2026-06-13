import { describe, expect, it } from "vitest";
import { splitMarked } from "../lib/highlight";

describe("splitMarked", () => {
  it("splits a highlighted string into marked and plain segments", () => {
    expect(splitMarked("plush <mark>velvet</mark> chair")).toEqual([
      { text: "plush ", marked: false },
      { text: "velvet", marked: true },
      { text: " chair", marked: false },
    ]);
  });

  it("handles multiple marked terms", () => {
    expect(splitMarked("<mark>velvet</mark> accent <mark>chair</mark>")).toEqual([
      { text: "velvet", marked: true },
      { text: " accent ", marked: false },
      { text: "chair", marked: true },
    ]);
  });

  it("returns one plain segment when nothing is marked", () => {
    expect(splitMarked("solid wood platform bed")).toEqual([
      { text: "solid wood platform bed", marked: false },
    ]);
  });
});
