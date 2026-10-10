import { Booking, MaintenanceRecord } from '../types';

export interface TimeSlot {
  start: Date;
  end: Date;
}

/**
 * Standard interval overlap formula:
 * Two slots clash if and only if: a.start < b.end AND a.end > b.start.
 * Back-to-back slots where a.end === b.start or b.end === a.start are NOT a clash.
 */
export function hasOverlap(a: TimeSlot, b: TimeSlot): boolean {
  const aStart = a.start.getTime();
  const aEnd = a.end.getTime();
  const bStart = b.start.getTime();
  const bEnd = b.end.getTime();

  return aStart < bEnd && aEnd > bStart;
}

export interface AvailabilityCheckResult {
  ok: boolean;
  conflictingBookings: Booking[];
  conflictingMaintenance?: MaintenanceRecord;
  suggestedAlternativeSlots: TimeSlot[];
  reason?: string;
}

/**
 * Checks if a requested slot on a unit is available without clashing with active bookings or maintenance.
 * If there is a clash, calculates the next 3 available non-conflicting slots of the same duration.
 */
export function checkAvailability(
  unitId: string,
  start: Date,
  end: Date,
  activeBookings: Booking[],
  maintenanceRecords: MaintenanceRecord[] = [],
  excludeBookingId?: string
): AvailabilityCheckResult {
  if (start.getTime() >= end.getTime()) {
    return {
      ok: false,
      conflictingBookings: [],
      suggestedAlternativeSlots: [],
      reason: 'Start time must be strictly before end time',
    };
  }

  const requestedSlot: TimeSlot = { start, end };
  const durationMs = end.getTime() - start.getTime();

  // 1. Check maintenance conflict
  const unitMaintenance = maintenanceRecords.find(
    (m) =>
      m.unitId === unitId &&
      m.isActive &&
      hasOverlap(requestedSlot, { start: m.startedAt, end: m.expectedReturnTime })
  );

  // 2. Check bookings conflict (only active bookings on the same unit, excluding any specified ID)
  const unitBookings = activeBookings.filter(
    (b) => b.unitId === unitId && b.status === 'active' && b.id !== excludeBookingId
  );

  const conflictingBookings = unitBookings.filter((b) =>
    hasOverlap(requestedSlot, { start: b.startTime, end: b.endTime })
  );

  const isConflict = Boolean(unitMaintenance) || conflictingBookings.length > 0;

  if (!isConflict) {
    return {
      ok: true,
      conflictingBookings: [],
      suggestedAlternativeSlots: [],
    };
  }

  // Find 3 suggested alternative slots of identical duration
  const suggestedAlternativeSlots: TimeSlot[] = [];
  
  // Start search from either end of the clash or next 30-minute block
  let searchCursor = new Date(Math.max(Date.now(), start.getTime()));
  // Round up to nearest 30 mins
  const minutes = searchCursor.getMinutes();
  searchCursor.setMinutes(minutes < 30 ? 30 : 60, 0, 0);

  let searchAttempts = 0;
  const maxAttempts = 120; // Up to ~60 hours forward in 30-min steps

  while (suggestedAlternativeSlots.length < 3 && searchAttempts < maxAttempts) {
    searchAttempts++;
    const candidateStart = new Date(searchCursor.getTime());
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);

    // Only suggest slots between 08:00 and 22:00 campus hours
    const startHour = candidateStart.getHours();
    const endHour = candidateEnd.getHours();
    const endMinutes = candidateEnd.getMinutes();
    const validHours = startHour >= 8 && (endHour < 22 || (endHour === 22 && endMinutes === 0));

    if (validHours) {
      const candidateSlot: TimeSlot = { start: candidateStart, end: candidateEnd };

      // Check maintenance
      const hasMaintConflict = maintenanceRecords.some(
        (m) =>
          m.unitId === unitId &&
          m.isActive &&
          hasOverlap(candidateSlot, { start: m.startedAt, end: m.expectedReturnTime })
      );

      // Check bookings
      const hasBookingConflict = unitBookings.some((b) =>
        hasOverlap(candidateSlot, { start: b.startTime, end: b.endTime })
      );

      // Make sure it doesn't overlap the initially requested conflicting slot
      const isOriginalSlot = candidateStart.getTime() === start.getTime();

      if (!hasMaintConflict && !hasBookingConflict && !isOriginalSlot) {
        suggestedAlternativeSlots.push(candidateSlot);
        // Jump search cursor forward by duration to prevent overlapping suggestions
        searchCursor = new Date(candidateEnd.getTime());
        continue;
      }
    }

    // Step by 30 mins
    searchCursor = new Date(searchCursor.getTime() + 30 * 60 * 1000);
  }

  return {
    ok: false,
    conflictingBookings,
    conflictingMaintenance: unitMaintenance,
    suggestedAlternativeSlots,
    reason: unitMaintenance
      ? `Unit is under maintenance (${unitMaintenance.reason}) until ${unitMaintenance.expectedReturnTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : `Slot overlaps with active booking by ${conflictingBookings.map((b) => b.userName).join(', ')}`,
  };
}
