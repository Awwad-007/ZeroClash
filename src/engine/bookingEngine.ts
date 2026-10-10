import {
  Booking,
  WaitlistEntry,
  HoldEntry,
  MaintenanceRecord,
  EquipmentUnit,
  UserRole,
  AuditLogEntry,
  EquipmentStatus,
} from '../types';
import { checkAvailability, TimeSlot } from './conflict';
import { calculatePriorityScore, processWaitlistCascade, handleHoldExpiry, CascadeResult } from './waitlist';

export interface CreateBookingParams {
  unitId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  startTime: Date;
  endTime: Date;
  purpose: string;
}

export interface JoinWaitlistParams {
  unitId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  startTime: Date;
  endTime: Date;
  urgency: 'low' | 'medium' | 'high';
  purpose: string;
  noShowCount?: number;
}

export class BookingEngine {
  private bookings: Booking[] = [];
  private waitlist: WaitlistEntry[] = [];
  private holds: HoldEntry[] = [];
  private maintenance: MaintenanceRecord[] = [];
  private auditLogs: AuditLogEntry[] = [];

  // Mutex lock map per unitId to guarantee race-condition serializability
  private locks: Map<string, Promise<void>> = new Map();

  constructor(initialData?: {
    bookings?: Booking[];
    waitlist?: WaitlistEntry[];
    holds?: HoldEntry[];
    maintenance?: MaintenanceRecord[];
    auditLogs?: AuditLogEntry[];
  }) {
    if (initialData?.bookings) this.bookings = [...initialData.bookings];
    if (initialData?.waitlist) this.waitlist = [...initialData.waitlist];
    if (initialData?.holds) this.holds = [...initialData.holds];
    if (initialData?.maintenance) this.maintenance = [...initialData.maintenance];
    if (initialData?.auditLogs) this.auditLogs = [...initialData.auditLogs];
  }

  // --- Lock Synchronization ---
  private async acquireLock(unitId: string): Promise<() => void> {
    while (this.locks.has(unitId)) {
      await this.locks.get(unitId);
    }
    let resolver: () => void;
    const promise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    this.locks.set(unitId, promise);

    return () => {
      this.locks.delete(unitId);
      resolver!();
    };
  }

  // --- Getters ---
  getBookings(): Booking[] {
    return [...this.bookings];
  }

  getWaitlist(): WaitlistEntry[] {
    return [...this.waitlist];
  }

  getHolds(): HoldEntry[] {
    return [...this.holds];
  }

  getMaintenance(): MaintenanceRecord[] {
    return [...this.maintenance];
  }

  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  // --- Booking Operations ---
  /**
   * Concurrency-safe atomic booking creation.
   * If two requests race for the same slot, the lock serializes them, and the second fails with a conflict.
   */
  async createBooking(params: CreateBookingParams): Promise<Booking> {
    const release = await this.acquireLock(params.unitId);
    try {
      // Simulate micro-delay in execution to expose race conditions in unmanaged async calls
      await new Promise((res) => setTimeout(res, 5));

      const availability = checkAvailability(
        params.unitId,
        params.startTime,
        params.endTime,
        this.bookings,
        this.maintenance
      );

      if (!availability.ok) {
        throw new Error(
          availability.reason || 'Requested slot clashes with an existing booking or maintenance'
        );
      }

      const newBooking: Booking = {
        id: `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        unitId: params.unitId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        startTime: params.startTime,
        endTime: params.endTime,
        purpose: params.purpose,
        status: 'active',
        createdAt: new Date(),
      };

      this.bookings.push(newBooking);

      this.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'CREATE_BOOKING',
        targetId: newBooking.id,
        details: `Slot booked by ${params.userName} for ${params.purpose}`,
        timestamp: new Date(),
        userId: params.userId,
      });

      return newBooking;
    } finally {
      release();
    }
  }

  /**
   * Cancels an existing booking and triggers the automated waitlist cascade.
   */
  async cancelBooking(bookingId: string, cancelledByUserId: string = 'system'): Promise<{
    cancelledBooking: Booking;
    cascadeResult: CascadeResult;
  }> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }
    if (booking.status !== 'active') {
      throw new Error(`Booking ${bookingId} is already ${booking.status}`);
    }

    const release = await this.acquireLock(booking.unitId);
    try {
      booking.status = 'cancelled';

      this.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'CANCEL_BOOKING',
        targetId: booking.id,
        details: `Booking ${booking.id} cancelled by ${cancelledByUserId}`,
        timestamp: new Date(),
        userId: cancelledByUserId,
      });

      // Trigger cascade for newly freed slot
      const releasedSlot: TimeSlot = { start: booking.startTime, end: booking.endTime };
      const cascadeResult = processWaitlistCascade(
        booking.unitId,
        releasedSlot,
        this.waitlist,
        this.holds,
        new Date()
      );

      this.waitlist = cascadeResult.updatedWaitlist;
      if (cascadeResult.newHold) {
        this.holds.push(cascadeResult.newHold);
        this.auditLogs.unshift({
          id: `log-${Date.now()}`,
          action: 'WAITLIST_HOLD',
          targetId: cascadeResult.newHold.id,
          details: cascadeResult.message,
          timestamp: new Date(),
          userId: cascadeResult.newHold.userId,
        });
      }

      return {
        cancelledBooking: booking,
        cascadeResult,
      };
    } finally {
      release();
    }
  }

  /**
   * Atomic modify booking: cancel + rebook with automatic rollback on clash.
   */
  async modifyBooking(
    bookingId: string,
    newStart: Date,
    newEnd: Date,
    userId: string = 'system'
  ): Promise<Booking> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const release = await this.acquireLock(booking.unitId);
    try {
      // Step 1: Validate new slot excluding current booking ID
      const availability = checkAvailability(
        booking.unitId,
        newStart,
        newEnd,
        this.bookings,
        this.maintenance,
        bookingId
      );

      if (!availability.ok) {
        // Rollback: Keep original slot intact
        throw new Error(
          `Modification clash: ${availability.reason || 'New slot is not available'}. Original slot retained.`
        );
      }

      // Step 2: Apply modification atomically
      const oldStart = booking.startTime;
      const oldEnd = booking.endTime;
      booking.startTime = newStart;
      booking.endTime = newEnd;

      this.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'MODIFY_BOOKING',
        targetId: booking.id,
        details: `Rescheduled from ${oldStart.toLocaleTimeString()} to ${newStart.toLocaleTimeString()}`,
        timestamp: new Date(),
        userId,
      });

      return booking;
    } finally {
      release();
    }
  }

  /**
   * Adds an entry to the priority waitlist.
   */
  joinWaitlist(params: JoinWaitlistParams): WaitlistEntry {
    const scoreBreakdown = calculatePriorityScore(
      params.userRole,
      params.urgency,
      params.noShowCount ?? 0
    );

    const entry: WaitlistEntry = {
      id: `wl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      unitId: params.unitId,
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      startTime: params.startTime,
      endTime: params.endTime,
      urgency: params.urgency,
      purpose: params.purpose,
      priorityScore: scoreBreakdown.totalScore,
      scoreBreakdown: {
        roleScore: scoreBreakdown.roleScore,
        urgencyScore: scoreBreakdown.urgencyScore,
        reliabilityScore: scoreBreakdown.reliabilityScore,
      },
      status: 'waiting',
      requestedAt: new Date(),
    };

    this.waitlist.push(entry);

    this.auditLogs.unshift({
      id: `log-${Date.now()}`,
      action: 'WAITLIST_HOLD',
      targetId: entry.id,
      details: `${params.userName} joined waitlist with priority score ${entry.priorityScore}`,
      timestamp: new Date(),
      userId: params.userId,
    });

    return entry;
  }

  /**
   * Confirms a provisional hold and turns it into an active confirmed booking.
   */
  confirmHold(holdId: string): Booking {
    const hold = this.holds.find((h) => h.id === holdId && !h.expired && !h.confirmed);
    if (!hold) {
      throw new Error(`Valid active hold ${holdId} not found`);
    }

    hold.confirmed = true;

    // Update waitlist entry
    const waitlistEntry = this.waitlist.find((w) => w.id === hold.waitlistEntryId);
    if (waitlistEntry) {
      waitlistEntry.status = 'promoted';
    }

    const newBooking: Booking = {
      id: `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      unitId: hold.unitId,
      userId: hold.userId,
      userName: hold.userName,
      userRole: hold.userRole,
      startTime: hold.startTime,
      endTime: hold.endTime,
      purpose: waitlistEntry?.purpose || 'Promoted from waitlist',
      status: 'active',
      createdAt: new Date(),
    };

    this.bookings.push(newBooking);

    this.auditLogs.unshift({
      id: `log-${Date.now()}`,
      action: 'HOLD_CONFIRMED',
      targetId: hold.id,
      details: `Hold confirmed by ${hold.userName}. Booking created ${newBooking.id}`,
      timestamp: new Date(),
      userId: hold.userId,
    });

    return newBooking;
  }

  /**
   * Manually or automatically expire a hold and trigger cascade to next candidate.
   */
  expireHold(holdId: string, currentTime: Date = new Date()) {
    const res = handleHoldExpiry(holdId, this.waitlist, this.holds, currentTime);
    this.holds = res.updatedHolds;
    if (res.cascadeResult) {
      this.waitlist = res.cascadeResult.updatedWaitlist;
      if (res.cascadeResult.newHold) {
        this.holds.push(res.cascadeResult.newHold);
      }
    }
    return res;
  }

  /**
   * Toggles or sets hardware maintenance.
   * When enabled, automatically cancels future active bookings clashing with the maintenance window!
   */
  setMaintenance(
    unitId: string,
    isActive: boolean,
    reason: string = 'Routine Hardware Diagnostics',
    expectedReturnTime: Date = new Date(Date.now() + 24 * 60 * 60 * 1000),
    startedAt: Date = new Date(),
    cancelledByUserId: string = 'admin'
  ): { maintenanceRecord: MaintenanceRecord; cancelledBookings: Booking[] } {
    let record = this.maintenance.find((m) => m.unitId === unitId);
    const cancelledBookings: Booking[] = [];

    if (isActive) {
      const now = startedAt;
      const maintSlot: TimeSlot = { start: now, end: expectedReturnTime };

      // Find and auto-cancel conflicting active bookings
      const clashingBookings = this.bookings.filter(
        (b) =>
          b.unitId === unitId &&
          b.status === 'active' &&
          (b.startTime.getTime() < expectedReturnTime.getTime() &&
            b.endTime.getTime() > now.getTime())
      );

      for (const cb of clashingBookings) {
        cb.status = 'cancelled';
        cancelledBookings.push(cb);
        this.auditLogs.unshift({
          id: `log-${Date.now()}`,
          action: 'CANCEL_BOOKING',
          targetId: cb.id,
          details: `Auto-cancelled due to emergency maintenance: ${reason}`,
          timestamp: new Date(),
          userId: cancelledByUserId,
        });
      }

      if (record) {
        record.isActive = true;
        record.reason = reason;
        record.expectedReturnTime = expectedReturnTime;
        record.startedAt = now;
        record.cancelledBookingIds = [
          ...record.cancelledBookingIds,
          ...cancelledBookings.map((b) => b.id),
        ];
      } else {
        record = {
          id: `maint-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          unitId,
          isActive: true,
          reason,
          expectedReturnTime,
          startedAt: now,
          cancelledBookingIds: cancelledBookings.map((b) => b.id),
        };
        this.maintenance.push(record);
      }

      this.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'SET_MAINTENANCE',
        targetId: unitId,
        details: `Unit placed in maintenance until ${expectedReturnTime.toISOString()}. ${cancelledBookings.length} future bookings auto-cancelled.`,
        timestamp: new Date(),
        userId: cancelledByUserId,
      });
    } else {
      if (record) {
        record.isActive = false;
        this.auditLogs.unshift({
          id: `log-${Date.now()}`,
          action: 'CLEAR_MAINTENANCE',
          targetId: unitId,
          details: `Maintenance cleared. Unit returned to service.`,
          timestamp: new Date(),
          userId: cancelledByUserId,
        });
      }
    }

    return {
      maintenanceRecord: record!,
      cancelledBookings,
    };
  }

  /**
   * Dynamically derives unit status and display text from real bookings and timestamps.
   */
  deriveUnitStatus(
    unit: EquipmentUnit,
    currentTime: Date = new Date()
  ): {
    status: EquipmentStatus;
    statusText: string;
    currentBooking?: Booking;
    nextBooking?: {
      startTime: string;
      endTime: string;
      userName: string;
    };
  } {
    // 1. Check active maintenance
    const activeMaint = this.maintenance.find(
      (m) =>
        m.unitId === unit.id &&
        m.isActive &&
        m.startedAt.getTime() <= currentTime.getTime() &&
        currentTime.getTime() < m.expectedReturnTime.getTime()
    );

    if (activeMaint) {
      const returnStr = activeMaint.expectedReturnTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        status: 'maintenance',
        statusText: `MAINTENANCE - ${activeMaint.reason} until ${returnStr}`,
      };
    }

    // 2. Check current in-use booking
    const activeUnitBookings = this.bookings.filter(
      (b) => b.unitId === unit.id && b.status === 'active'
    );

    const currentBooking = activeUnitBookings.find(
      (b) =>
        b.startTime.getTime() <= currentTime.getTime() &&
        currentTime.getTime() < b.endTime.getTime()
    );

    if (currentBooking) {
      const endStr = currentBooking.endTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        status: 'booked',
        statusText: `IN USE until ${endStr} today (${currentBooking.userName})`,
        currentBooking,
      };
    }

    // 3. Unit is available right now. Check for upcoming bookings
    const futureBookings = activeUnitBookings
      .filter((b) => b.startTime.getTime() > currentTime.getTime())
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    if (futureBookings.length > 0) {
      const next = futureBookings[0];
      const startStr = next.startTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const endStr = next.endTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        status: 'available',
        statusText: `AVAILABLE until ${startStr} today`,
        nextBooking: {
          startTime: startStr,
          endTime: endStr,
          userName: next.userName,
        },
      };
    }

    return {
      status: 'available',
      statusText: 'AVAILABLE for reservation',
    };
  }
}
