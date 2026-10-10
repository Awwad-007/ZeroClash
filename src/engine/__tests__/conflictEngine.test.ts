import { describe, it, expect, beforeEach } from 'vitest';
import { hasOverlap, checkAvailability } from '../conflict';
import { BookingEngine } from '../bookingEngine';
import { calculatePriorityScore, processWaitlistCascade, handleHoldExpiry } from '../waitlist';
import { Booking, WaitlistEntry, HoldEntry } from '../../types';

describe('ZeroClash Conflict Engine', () => {
  const baseDate = new Date('2026-10-10T08:00:00Z');
  const makeTime = (hours: number, minutes: number = 0) => {
    const d = new Date(baseDate);
    d.setUTCHours(hours, minutes, 0, 0);
    return d;
  };

  describe('Interval Overlap Logic (hasOverlap)', () => {
    it('detects partial overlap between two intervals', () => {
      const a = { start: makeTime(10), end: makeTime(12) };
      const b = { start: makeTime(11), end: makeTime(13) };
      expect(hasOverlap(a, b)).toBe(true);
      expect(hasOverlap(b, a)).toBe(true);
    });

    it('treats back-to-back slots (end === start) as NOT a clash', () => {
      const a = { start: makeTime(10), end: makeTime(12) };
      const b = { start: makeTime(12), end: makeTime(14) };
      expect(hasOverlap(a, b)).toBe(false);
      expect(hasOverlap(b, a)).toBe(false);
    });

    it('detects contained interval (inner slot inside outer slot)', () => {
      const outer = { start: makeTime(10), end: makeTime(15) };
      const inner = { start: makeTime(11), end: makeTime(13) };
      expect(hasOverlap(outer, inner)).toBe(true);
      expect(hasOverlap(inner, outer)).toBe(true);
    });

    it('detects spanning interval (outer slot completely engulfs inner slot)', () => {
      const inner = { start: makeTime(12), end: makeTime(13) };
      const outer = { start: makeTime(10), end: makeTime(16) };
      expect(hasOverlap(inner, outer)).toBe(true);
    });

    it('returns false for completely disjoint non-touching intervals', () => {
      const a = { start: makeTime(9), end: makeTime(11) };
      const b = { start: makeTime(14), end: makeTime(16) };
      expect(hasOverlap(a, b)).toBe(false);
    });
  });

  describe('Availability & Alternative Slot Suggestions', () => {
    it('returns ok: true when no conflicting bookings exist', () => {
      const result = checkAvailability('eq-gpu-01', makeTime(9), makeTime(11), []);
      expect(result.ok).toBe(true);
      expect(result.conflictingBookings).toHaveLength(0);
    });

    it('returns ok: false and suggests alternative slots on clash', () => {
      const existing: Booking = {
        id: 'bk-1',
        unitId: 'eq-gpu-01',
        userId: 'usr-1',
        userName: 'Alex M.',
        userRole: 'Student',
        startTime: makeTime(10),
        endTime: makeTime(14),
        purpose: 'AI Model Training',
        status: 'active',
        createdAt: new Date(),
      };

      const result = checkAvailability('eq-gpu-01', makeTime(11), makeTime(13), [existing]);
      expect(result.ok).toBe(false);
      expect(result.conflictingBookings).toHaveLength(1);
      expect(result.conflictingBookings[0].id).toBe('bk-1');
      expect(result.suggestedAlternativeSlots.length).toBeGreaterThan(0);
      expect(result.suggestedAlternativeSlots.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Waitlist Priority Scoring & Cascade', () => {
    it('calculates priority scores accurately: Faculty > Researcher > Student', () => {
      const faculty = calculatePriorityScore('Faculty', 'high', 0);
      const researcher = calculatePriorityScore('Researcher', 'high', 0);
      const student = calculatePriorityScore('Student', 'high', 0);

      expect(faculty.totalScore).toBeGreaterThan(researcher.totalScore);
      expect(researcher.totalScore).toBeGreaterThan(student.totalScore);
    });

    it('penalizes no-show history in reliability score', () => {
      const reliable = calculatePriorityScore('Student', 'high', 0);
      const unreliable = calculatePriorityScore('Student', 'high', 3);

      expect(reliable.reliabilityScore).toBe(100);
      expect(unreliable.reliabilityScore).toBe(55);
      expect(reliable.totalScore).toBeGreaterThan(unreliable.totalScore);
    });

    it('assigns 10-minute hold to top-scored waitlist candidate on slot release', () => {
      const releasedSlot = { start: makeTime(10), end: makeTime(12) };
      const waitlist: WaitlistEntry[] = [
        {
          id: 'wl-1',
          unitId: 'eq-cam-01',
          userId: 'usr-student',
          userName: 'Student User',
          userRole: 'Student',
          startTime: makeTime(10),
          endTime: makeTime(12),
          urgency: 'low',
          purpose: 'Class project',
          priorityScore: 50,
          scoreBreakdown: { roleScore: 50, urgencyScore: 25, reliabilityScore: 100 },
          status: 'waiting',
          requestedAt: makeTime(8),
        },
        {
          id: 'wl-2',
          unitId: 'eq-cam-01',
          userId: 'usr-faculty',
          userName: 'Dr. Evelyn Reed',
          userRole: 'Faculty',
          startTime: makeTime(10),
          endTime: makeTime(12),
          urgency: 'high',
          purpose: 'Lab research',
          priorityScore: 96,
          scoreBreakdown: { roleScore: 90, urgencyScore: 100, reliabilityScore: 100 },
          status: 'waiting',
          requestedAt: makeTime(8, 30),
        },
      ];

      const cascade = processWaitlistCascade('eq-cam-01', releasedSlot, waitlist, [], baseDate);
      expect(cascade.candidatePromoted).not.toBeNull();
      expect(cascade.candidatePromoted?.userId).toBe('usr-faculty');
      expect(cascade.newHold).not.toBeNull();
      // Hold expires 10 minutes later
      const diffMinutes =
        (cascade.newHold!.expiresAt.getTime() - cascade.newHold!.heldAt.getTime()) / (60 * 1000);
      expect(diffMinutes).toBe(10);
    });

    it('cascades to next candidate when a provisional hold expires', () => {
      const candidate1: WaitlistEntry = {
        id: 'wl-1',
        unitId: 'eq-cam-01',
        userId: 'usr-1',
        userName: 'Faculty First',
        userRole: 'Faculty',
        startTime: makeTime(10),
        endTime: makeTime(12),
        urgency: 'high',
        purpose: 'Research',
        priorityScore: 95,
        scoreBreakdown: { roleScore: 90, urgencyScore: 100, reliabilityScore: 100 },
        status: 'on_hold',
        requestedAt: makeTime(8),
        holdExpiresAt: makeTime(8, 10),
      };

      const candidate2: WaitlistEntry = {
        id: 'wl-2',
        unitId: 'eq-cam-01',
        userId: 'usr-2',
        userName: 'Researcher Second',
        userRole: 'Researcher',
        startTime: makeTime(10),
        endTime: makeTime(12),
        urgency: 'high',
        purpose: 'Study',
        priorityScore: 85,
        scoreBreakdown: { roleScore: 75, urgencyScore: 100, reliabilityScore: 100 },
        status: 'waiting',
        requestedAt: makeTime(8, 15),
      };

      const activeHold: HoldEntry = {
        id: 'hld-1',
        waitlistEntryId: 'wl-1',
        unitId: 'eq-cam-01',
        userId: 'usr-1',
        userName: 'Faculty First',
        userRole: 'Faculty',
        startTime: makeTime(10),
        endTime: makeTime(12),
        heldAt: makeTime(8),
        expiresAt: makeTime(8, 10),
        confirmed: false,
        expired: false,
      };

      const expiryResult = handleHoldExpiry(
        'hld-1',
        [candidate1, candidate2],
        [activeHold],
        makeTime(8, 11)
      );

      expect(expiryResult.expiredHold?.expired).toBe(true);
      expect(expiryResult.cascadeResult?.candidatePromoted?.userId).toBe('usr-2');
    });
  });

  describe('Transactional BookingEngine', () => {
    let engine: BookingEngine;

    beforeEach(() => {
      engine = new BookingEngine();
    });

    it('simultaneous double-click race condition: second request must fail', async () => {
      const req1 = {
        unitId: 'eq-gpu-01',
        userId: 'usr-1',
        userName: 'User A',
        userRole: 'Student' as const,
        startTime: makeTime(14),
        endTime: makeTime(16),
        purpose: 'Task A',
      };

      const req2 = {
        unitId: 'eq-gpu-01',
        userId: 'usr-2',
        userName: 'User B',
        userRole: 'Researcher' as const,
        startTime: makeTime(14),
        endTime: makeTime(16),
        purpose: 'Task B',
      };

      // Fire both asynchronous booking calls simultaneously
      const results = await Promise.allSettled([
        engine.createBooking(req1),
        engine.createBooking(req2),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly ONE must succeed and ONE must fail
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(engine.getBookings().filter((b) => b.status === 'active')).toHaveLength(1);
    });

    it('cancelling a booking frees slot and triggers waitlist cascade', async () => {
      const booking = await engine.createBooking({
        unitId: 'eq-vr-01',
        userId: 'usr-1',
        userName: 'User A',
        userRole: 'Student',
        startTime: makeTime(10),
        endTime: makeTime(12),
        purpose: 'Original Booking',
      });

      // Join waitlist for same slot
      engine.joinWaitlist({
        unitId: 'eq-vr-01',
        userId: 'usr-2',
        userName: 'Dr. Waitlisted',
        userRole: 'Faculty',
        startTime: makeTime(10),
        endTime: makeTime(12),
        urgency: 'high',
        purpose: 'Urgent Lecture',
      });

      const cancelRes = await engine.cancelBooking(booking.id, 'usr-1');
      expect(cancelRes.cancelledBooking.status).toBe('cancelled');
      expect(cancelRes.cascadeResult.candidatePromoted?.userName).toBe('Dr. Waitlisted');
      expect(engine.getHolds()).toHaveLength(1);
    });

    it('modifyBooking performs atomic cancel + rebook and rolls back on clash', async () => {
      const booking1 = await engine.createBooking({
        unitId: 'eq-cam-01',
        userId: 'usr-1',
        userName: 'User 1',
        userRole: 'Student',
        startTime: makeTime(10),
        endTime: makeTime(12),
        purpose: 'Slot 1',
      });

      const booking2 = await engine.createBooking({
        unitId: 'eq-cam-01',
        userId: 'usr-2',
        userName: 'User 2',
        userRole: 'Faculty',
        startTime: makeTime(14),
        endTime: makeTime(16),
        purpose: 'Slot 2',
      });

      // Attempt to modify booking1 to overlap with booking2 (14:30 to 16:30)
      await expect(
        engine.modifyBooking(booking1.id, makeTime(14, 30), makeTime(16, 30))
      ).rejects.toThrow(/Modification clash/);

      // Verify original slot is retained (rollback successful)
      const b1 = engine.getBookings().find((b) => b.id === booking1.id);
      expect(b1?.startTime.getTime()).toBe(makeTime(10).getTime());
      expect(b1?.endTime.getTime()).toBe(makeTime(12).getTime());
    });

    it('setting maintenance auto-cancels future bookings and locks equipment', async () => {
      const futureBooking = await engine.createBooking({
        unitId: 'eq-print-01',
        userId: 'usr-1',
        userName: 'Marcus Vance',
        userRole: 'Student',
        startTime: makeTime(12),
        endTime: makeTime(15),
        purpose: '3D Chassis',
      });

      const maintResult = engine.setMaintenance(
        'eq-print-01',
        true,
        'Laser Recalibration',
        makeTime(18),
        makeTime(8)
      );

      expect(maintResult.cancelledBookings).toHaveLength(1);
      expect(maintResult.cancelledBookings[0].id).toBe(futureBooking.id);

      // Verify future booking status is now cancelled
      const b = engine.getBookings().find((item) => item.id === futureBooking.id);
      expect(b?.status).toBe('cancelled');

      // Verify new booking attempt during maintenance window is rejected
      await expect(
        engine.createBooking({
          unitId: 'eq-print-01',
          userId: 'usr-2',
          userName: 'Priya S.',
          userRole: 'Researcher',
          startTime: makeTime(13),
          endTime: makeTime(14),
          purpose: 'New print attempt',
        })
      ).rejects.toThrow(/maintenance/i);
    });
  });
});
