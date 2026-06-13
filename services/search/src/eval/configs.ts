import { DEFAULT_RANKING, type RankingConfig } from "../search/query.ts";

/**
 * Candidate ranking configs for the tuning sweep (Step 7). Each targets the
 * known weaknesses of the baseline (the "light chair" case): fuzziness turning
 * "light" into "right", OR semantics letting a one-word match win, repeated
 * terms dominating, and no reward for the words appearing together. The sweep
 * measures each against the train split; the winner graduates into
 * DEFAULT_RANKING.
 */
export interface NamedConfig {
  name: string;
  config: RankingConfig;
}

export const RANKING_CANDIDATES: NamedConfig[] = [
  { name: "baseline (default)", config: DEFAULT_RANKING },
  {
    name: "prefix2",
    config: { ...DEFAULT_RANKING, fuzzyPrefixLength: 2 },
  },
  {
    name: "prefix2 + phrase4",
    config: { ...DEFAULT_RANKING, fuzzyPrefixLength: 2, phraseBoost: 4 },
  },
  {
    name: "prefix2 + phrase4 + msm",
    config: {
      ...DEFAULT_RANKING,
      fuzzyPrefixLength: 2,
      phraseBoost: 4,
      minimumShouldMatch: "2<75%",
    },
  },
  {
    name: "prefix2 + phrase4 + pop0.5",
    config: {
      ...DEFAULT_RANKING,
      fuzzyPrefixLength: 2,
      phraseBoost: 4,
      popularityWeight: 0.5,
    },
  },
  {
    name: "all (prefix2 phrase4 msm pop0.5)",
    config: {
      ...DEFAULT_RANKING,
      fuzzyPrefixLength: 2,
      phraseBoost: 4,
      minimumShouldMatch: "2<75%",
      popularityWeight: 0.5,
    },
  },
];
