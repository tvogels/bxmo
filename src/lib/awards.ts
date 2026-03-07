import type { Participant, Thresholds } from './data';
import { participantScore } from './data';

// ---------------------------------------------------------------------------
// Award types
// ---------------------------------------------------------------------------

export type Award = 'gold' | 'silver' | 'bronze' | 'hm' | null;

// ---------------------------------------------------------------------------
// Award calculation — replicates the original Symfony logic
//
// Rules:
//   - score >= gold threshold   → gold
//   - score >= silver threshold → silver
//   - score >= bronze threshold → bronze
//   - if honourableMentions enabled AND participant scored 7 on any problem
//     AND no medal → honourable mention
//   - otherwise → null (no award)
// ---------------------------------------------------------------------------

export function calculateAward(
  participant: Participant,
  thresholds: Thresholds,
  honourableMentions: boolean,
): Award {
  const score = participantScore(participant);

  if (score >= thresholds.gold) return 'gold';
  if (score >= thresholds.silver) return 'silver';
  if (score >= thresholds.bronze) return 'bronze';

  if (honourableMentions && participant.scores.some((s) => s === 7)) {
    return 'hm';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Compute awards for all participants in an edition
// ---------------------------------------------------------------------------

export interface ParticipantWithAward extends Participant {
  award: Award;
  totalScore: number;
}

export function computeAwards(
  participants: Participant[],
  thresholds: Thresholds,
  honourableMentions: boolean,
): ParticipantWithAward[] {
  return participants.map((p) => ({
    ...p,
    award: calculateAward(p, thresholds, honourableMentions),
    totalScore: participantScore(p),
  }));
}

// ---------------------------------------------------------------------------
// Medal summary
// ---------------------------------------------------------------------------

export interface MedalCounts {
  gold: number;
  silver: number;
  bronze: number;
  hm: number;
  none: number;
  total: number;
}

export function countMedals(participants: ParticipantWithAward[]): MedalCounts {
  const counts: MedalCounts = {
    gold: 0,
    silver: 0,
    bronze: 0,
    hm: 0,
    none: 0,
    total: participants.length,
  };

  for (const p of participants) {
    if (p.award === 'gold') counts.gold++;
    else if (p.award === 'silver') counts.silver++;
    else if (p.award === 'bronze') counts.bronze++;
    else if (p.award === 'hm') counts.hm++;
    else counts.none++;
  }

  return counts;
}

export const AWARD_LABELS: Record<string, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  hm: 'Honourable Mention',
};

export const AWARD_EMOJI: Record<string, string> = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
  hm: '📜',
};
