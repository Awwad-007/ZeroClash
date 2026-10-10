import { UserRole, WaitlistEntry, HoldEntry, Booking, TimeSlot } from '../types';
import { hasOverlap } from './conflict';

export const ROLE_WEIGHTS: Record<UserRole, number> = {
  'Lab Admin': 100,
  Faculty: 90,
  Researcher: 75,
  Student: 50,
};

export const URGENCY_WEIGHTS: Record<'low' | 'medium' | 'high', number> = {
  high: 100,
  medium: 60,
  low: 25,
};

export interface PriorityScoreBreakdown {
  roleScore: number;
  urgencyScore: number;
  reliabilityScore: number;
  totalScore: number;
}

/**
 * Multi-factor priority score calculation:
 * Priority = (Role Weight * 0.4) + (Urgency * 0.4) + (Reliability * 0.2)
 * Normalized to 0-100.
 */
export function calculatePriorityScore(
  role: UserRole,
  urgency: 'low' | 'medium' | 'high',
  noShowCount: number = 0
): PriorityScoreBreakdown {
  const roleScore = ROLE_WEIGHTS[role] || 50;
  const urgencyScore = URGENCY_WEIGHTS[urgency] || 50;
  const reliabilityScore = Math.max(0, 100 - noShowCount * 15);

  const totalScore = Math.round(
    roleScore * 0.4 + urgencyScore * 0.4 + reliabilityScore * 0.2
  );

  return {
    roleScore,
    urgencyScore,
    reliabilityScore,
    totalScore,
  };
}

export interface CascadeResult {
  candidatePromoted: WaitlistEntry | null;
  newHold: HoldEntry | null;
  updatedWaitlist: WaitlistEntry[];
  message: string;
}

/**
 * Triggers waitlist cascade for an opened/cancelled slot.
 * Locates the top-ranked waiting entry for that unit that matches/overlaps the slot,
 * generates a 10-minute provisional hold, and updates waitlist statuses.
 */
export function processWaitlistCascade(
  unitId: string,
  releasedSlot: TimeSlot,
  waitlistEntries: WaitlistEntry[],
  currentHolds: HoldEntry[] = [],
  currentTime: Date = new Date()
): CascadeResult {
  // Filter candidates waiting on this unit whose requested window overlaps the released slot
  const eligibleCandidates = waitlistEntries.filter((entry) => {
    if (entry.unitId !== unitId || entry.status !== 'waiting') return false;
    return hasOverlap(releasedSlot, { start: entry.startTime, end: entry.endTime });
  });

  if (eligibleCandidates.length === 0) {
    return {
      candidatePromoted: null,
      newHold: null,
      updatedWaitlist: waitlistEntries,
      message: 'No eligible candidates in waitlist for this slot.',
    };
  }

  // Sort by priorityScore DESC, then requestedAt ASC (earlier requester wins tie)
  eligibleCandidates.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.requestedAt.getTime() - b.requestedAt.getTime();
  });

  const topCandidate = eligibleCandidates[0];
  const holdDurationMs = 10 * 60 * 1000; // 10 minutes hold
  const holdExpiresAt = new Date(currentTime.getTime() + holdDurationMs);
  const holdId = `hld-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newHold: HoldEntry = {
    id: holdId,
    waitlistEntryId: topCandidate.id,
    unitId: topCandidate.unitId,
    userId: topCandidate.userId,
    userName: topCandidate.userName,
    userRole: topCandidate.userRole,
    startTime: topCandidate.startTime,
    endTime: topCandidate.endTime,
    heldAt: currentTime,
    expiresAt: holdExpiresAt,
    confirmed: false,
    expired: false,
  };

  const updatedWaitlist = waitlistEntries.map((w) => {
    if (w.id === topCandidate.id) {
      return {
        ...w,
        status: 'on_hold' as const,
        holdExpiresAt,
        holdId,
      };
    }
    return w;
  });

  return {
    candidatePromoted: {
      ...topCandidate,
      status: 'on_hold',
      holdExpiresAt,
      holdId,
    },
    newHold,
    updatedWaitlist,
    message: `Provisional hold assigned to ${topCandidate.userName} (${topCandidate.userRole}, Score: ${topCandidate.priorityScore}). Hold expires in 10 minutes.`,
  };
}

/**
 * Checks and expires a timed-out hold, then automatically cascades to the next eligible candidate in line.
 */
export function handleHoldExpiry(
  holdId: string,
  waitlistEntries: WaitlistEntry[],
  holds: HoldEntry[],
  currentTime: Date = new Date()
): {
  expiredHold: HoldEntry | null;
  updatedHolds: HoldEntry[];
  cascadeResult: CascadeResult | null;
} {
  const hold = holds.find((h) => h.id === holdId);
  if (!hold || hold.confirmed || hold.expired) {
    return { expiredHold: null, updatedHolds: holds, cascadeResult: null };
  }

  // Mark hold expired
  const expiredHold: HoldEntry = { ...hold, expired: true };
  const updatedHolds = holds.map((h) => (h.id === holdId ? expiredHold : h));

  // Mark corresponding waitlist entry as expired
  const updatedWaitlist = waitlistEntries.map((w) => {
    if (w.id === hold.waitlistEntryId) {
      return { ...w, status: 'expired' as const };
    }
    return w;
  });

  // Cascade to next candidate
  const cascade = processWaitlistCascade(
    hold.unitId,
    { start: hold.startTime, end: hold.endTime },
    updatedWaitlist,
    updatedHolds,
    currentTime
  );

  return {
    expiredHold,
    updatedHolds: cascade.newHold ? [...updatedHolds, cascade.newHold] : updatedHolds,
    cascadeResult: cascade,
  };
}
