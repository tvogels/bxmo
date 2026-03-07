import type { ParticipantWithAward } from './awards';
import type { Country } from './data';
import { countryName } from './data';

// ---------------------------------------------------------------------------
// Ranking — assigns rank with standard competition ranking (1224)
// ---------------------------------------------------------------------------

export interface RankedParticipant extends ParticipantWithAward {
  rank: number;
}

export function rankParticipants(
  participants: ParticipantWithAward[],
): RankedParticipant[] {
  const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);

  const ranked: RankedParticipant[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].totalScore < sorted[i - 1].totalScore) {
      currentRank = i + 1;
    }
    ranked.push({ ...sorted[i], rank: currentRank });
  }

  return ranked;
}

// ---------------------------------------------------------------------------
// Per-country statistics
// ---------------------------------------------------------------------------

export interface CountryStats {
  country: string;
  countryName: string;
  count: number;
  totalScore: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  q1: number;
  median: number;
  q3: number;
  perProblem: number[];
  gold: number;
  silver: number;
  bronze: number;
  hm: number;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[Math.floor(n / 2)];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function quartile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function computeCountryStats(
  participants: ParticipantWithAward[],
  countries?: Country[],
): CountryStats[] {
  const byCountry = new Map<string, ParticipantWithAward[]>();

  for (const p of participants) {
    const group = byCountry.get(p.country) ?? [];
    group.push(p);
    byCountry.set(p.country, group);
  }

  const stats: CountryStats[] = [];

  for (const [code, group] of byCountry) {
    const scores = group.map((p) => p.totalScore).sort((a, b) => a - b);
    const numProblems = group[0]?.scores.length ?? 4;
    const perProblem: number[] = [];

    for (let i = 0; i < numProblems; i++) {
      const sum = group.reduce((s, p) => s + p.scores[i], 0);
      perProblem.push(sum / group.length);
    }

    stats.push({
      country: code,
      countryName: countryName(code, countries),
      count: group.length,
      totalScore: scores.reduce((a, b) => a + b, 0),
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      minScore: scores[0],
      maxScore: scores[scores.length - 1],
      q1: quartile(scores, 0.25),
      median: median(scores),
      q3: quartile(scores, 0.75),
      perProblem,
      gold: group.filter((p) => p.award === 'gold').length,
      silver: group.filter((p) => p.award === 'silver').length,
      bronze: group.filter((p) => p.award === 'bronze').length,
      hm: group.filter((p) => p.award === 'hm').length,
    });
  }

  stats.sort((a, b) => b.avgScore - a.avgScore);
  return stats;
}

// ---------------------------------------------------------------------------
// Per-problem statistics
// ---------------------------------------------------------------------------

export interface ProblemStats {
  problem: number;
  mean: number;
  median: number;
  stddev: number;
  histogram: number[];
}

export function computeProblemStats(
  participants: ParticipantWithAward[],
): ProblemStats[] {
  const numProblems = participants[0]?.scores.length ?? 4;
  const stats: ProblemStats[] = [];

  for (let i = 0; i < numProblems; i++) {
    const scores = participants.map((p) => p.scores[i]).sort((a, b) => a - b);
    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n;

    // Histogram: count of each score 0–7
    const histogram = new Array(8).fill(0) as number[];
    for (const s of scores) {
      if (s >= 0 && s <= 7) histogram[s]++;
    }

    stats.push({
      problem: i + 1,
      mean,
      median: median(scores),
      stddev: Math.sqrt(variance),
      histogram,
    });
  }

  return stats;
}
