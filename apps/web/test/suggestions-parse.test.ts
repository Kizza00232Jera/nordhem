import { describe, expect, it } from "vitest";
import { parseSuggestionsJson } from "../lib/chat/suggestions-generate";

// The AI generator asks a model for synonym suggestions as JSON. Models wrap
// JSON in prose or code fences and sometimes emit junk, so the parser must find
// the array, validate each item to the SynonymInput shape, and drop anything
// malformed. Pure, so it is tested without a model.
describe("parseSuggestionsJson", () => {
  it("parses a clean array of valid suggestions", () => {
    const text = JSON.stringify([
      { query: "couch", kind: "oneway", terms: "couch", mapsTo: "sofa", rationale: "synonym" },
      { query: "lounge chair", kind: "equivalent", terms: "lounge chair, armchair", rationale: "same thing" },
    ]);
    const out = parseSuggestionsJson(text);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ query: "couch", kind: "oneway", terms: "couch", mapsTo: "sofa" });
    expect(out[1]).toMatchObject({ kind: "equivalent", mapsTo: null });
  });

  it("extracts the array from prose and code fences", () => {
    const text = 'Here are my ideas:\n```json\n[{"query":"telly","kind":"oneway","terms":"telly","mapsTo":"tv stand","rationale":"uk slang"}]\n```\nHope that helps.';
    expect(parseSuggestionsJson(text)).toHaveLength(1);
  });

  it("drops malformed items and bad kinds", () => {
    const text = JSON.stringify([
      { query: "ok", kind: "oneway", terms: "ok", mapsTo: "fine", rationale: "r" },
      { query: "no kind", terms: "x", rationale: "r" },
      { kind: "oneway", terms: "no query", rationale: "r" },
      { query: "bad kind", kind: "nonsense", terms: "x", rationale: "r" },
    ]);
    expect(parseSuggestionsJson(text)).toHaveLength(1);
  });

  it("returns nothing for junk", () => {
    expect(parseSuggestionsJson("sorry, I cannot help with that")).toEqual([]);
    expect(parseSuggestionsJson("")).toEqual([]);
  });
});
