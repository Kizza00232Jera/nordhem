/**
 * Step 11b heuristic generator. Turns zero-result queries into proposed
 * one-way synonyms when the query is a near-variant of a real catalog term
 * (a typo, a missing space, a plural). Pure and unit-tested; the CLI feeds it
 * logged zero-result queries + the catalog vocabulary and writes the proposals
 * to the approval queue. It intentionally does NOT invent semantic synonyms
 * (couch -> sofa share no letters) — that quality work is the Claude-session
 * path; here we only catch the cheap, high-confidence string variants.
 */

/** Character trigrams of a string, space-padded so word edges count. */
function trigrams(s: string): Set<string> {
  const t = `  ${s.toLowerCase().trim()} `;
  const set = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

/** Dice coefficient over character trigrams: 1 identical, 0 fully disjoint. */
export function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  return (2 * inter) / (A.size + B.size);
}

export interface SuggestionCandidate {
  query: string;
}

export interface ProposedSynonym {
  query: string;
  kind: "oneway";
  terms: string;
  mapsTo: string;
  similarity: number;
  rationale: string;
}

/**
 * For each candidate query, find the most trigram-similar catalog term; if it
 * clears the threshold (and isn't the query itself), propose a one-way synonym
 * mapping the query onto that term. Default threshold 0.5 keeps proposals to
 * genuine variants and lets true misses fall through.
 */
export function proposeSynonyms(
  candidates: SuggestionCandidate[],
  catalogTerms: string[],
  opts: { threshold?: number } = {},
): ProposedSynonym[] {
  const threshold = opts.threshold ?? 0.5;
  const out: ProposedSynonym[] = [];
  for (const c of candidates) {
    const q = c.query.toLowerCase().trim();
    let best = "";
    let bestSim = 0;
    for (const term of catalogTerms) {
      const t = term.toLowerCase().trim();
      if (t === q) {
        best = "";
        bestSim = 1;
        break; // query already matches a catalog term: no synonym needed
      }
      const sim = trigramSimilarity(q, t);
      if (sim > bestSim) {
        bestSim = sim;
        best = t;
      }
    }
    if (best && best !== q && bestSim >= threshold) {
      out.push({
        query: c.query,
        kind: "oneway",
        terms: q,
        mapsTo: best,
        similarity: bestSim,
        rationale: `"${q}" returned no results but is ${(bestSim * 100).toFixed(
          0,
        )}% similar to the catalog term "${best}"`,
      });
    }
  }
  return out;
}
