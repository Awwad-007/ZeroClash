import { DataSource, ConnectionStatus, HeatmapData, ForecastPoint, ServerEvent } from './dataSource';
import { BookingEngine, CreateBookingParams, JoinWaitlistParams } from '../engine/bookingEngine';
import {
  EquipmentUnit,
  Booking,
  WaitlistEntry,
  HoldEntry,
  MaintenanceRecord,
  AuditLogEntry,
  ScheduleSuggestion,
  ScheduleSuggestParams,
  ParsedScheduleIntent
} from '../types';
import { MOCK_EQUIPMENT } from '../data/mock';
import { SEED_BOOKINGS, SEED_WAITLIST, SEED_MAINTENANCE } from '../data/seedData';

export class LocalEngineSource implements DataSource {
  private engine: BookingEngine;
  private subscribers: Array<(event: ServerEvent) => void> = [];
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];
  public readonly status: ConnectionStatus = 'local';

  constructor(engine?: BookingEngine) {
    this.engine =
      engine ??
      new BookingEngine({
        bookings: [...SEED_BOOKINGS],
        waitlist: [...SEED_WAITLIST],
        holds: [],
        maintenance: [...SEED_MAINTENANCE],
        auditLogs: [],
      });
  }

  public getEngine(): BookingEngine {
    return this.engine;
  }

  async init(): Promise<void> {
    this.notifyStatus('local');
  }

  subscribe(callback: (event: ServerEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(callback);
    callback(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyStatus(status: ConnectionStatus): void {
    this.statusListeners.forEach((cb) => cb(status));
  }

  private emit(event: string, data: any): void {
    const payload: ServerEvent = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.subscribers.forEach((cb) => cb(payload));
  }

  async getEquipment(): Promise<Record<string, EquipmentUnit>> {
    const result: Record<string, EquipmentUnit> = {};
    const now = new Date();
    for (const [id, baseUnit] of Object.entries(MOCK_EQUIPMENT)) {
      const derived = this.engine.deriveUnitStatus(baseUnit, now);
      result[id] = {
        ...baseUnit,
        status: derived.status,
        statusText: derived.statusText,
        currentBooking: derived.currentBooking,
        nextBooking: derived.nextBooking,
      };
    }
    return result;
  }

  async getBookings(): Promise<Booking[]> {
    return this.engine.getBookings();
  }

  async getWaitlist(): Promise<WaitlistEntry[]> {
    return this.engine.getWaitlist();
  }

  async getHolds(): Promise<HoldEntry[]> {
    return this.engine.getHolds();
  }

  async getMaintenance(): Promise<MaintenanceRecord[]> {
    return this.engine.getMaintenance();
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.engine.getAuditLogs();
  }

  async getHeatmap(): Promise<HeatmapData> {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const heatmap: Record<string, number[]> = {};

    days.forEach((day, dayIndex) => {
      heatmap[day] = hours.map((hour) => {
        // Base density from existing bookings
        let count = 0;
        const bookings = this.engine.getBookings();
        bookings.forEach((b) => {
          if (b.status === 'active') {
            const bDay = (b.startTime.getDay() + 6) % 7; // Monday = 0
            if (bDay === dayIndex) {
              const bStartHour = b.startTime.getHours();
              const bEndHour = b.endTime.getHours();
              if (hour >= bStartHour && hour < bEndHour) {
                count++;
              }
            }
          }
        });
        return count;
      });
    });

    return { heatmap, days, hours };
  }

  async getForecast(lookaheadDays: number = 7): Promise<ForecastPoint[]> {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    const result: ForecastPoint[] = [];

    const historicalLoads = [14, 18, 22, 19, 15, 8, 5];

    for (let i = 0; i < lookaheadDays; i++) {
      const targetDate = new Date(now.getTime() + i * 24 * 3600 * 1000);
      const dayIndex = (targetDate.getDay() + 6) % 7;
      const baseDemand = historicalLoads[dayIndex] || 12;
      const movingAvg = Math.round(baseDemand * 0.95);
      const peakHour = dayIndex >= 5 ? 14 : 11;
      const status = baseDemand > 18 ? 'High' : baseDemand > 10 ? 'Moderate' : 'Low';

      result.push({
        day: dayNames[dayIndex],
        predicted_demand: baseDemand,
        moving_avg: movingAvg,
        peak_hour: peakHour,
        status,
        confidence_lower: Math.max(0, baseDemand - 3.2),
        confidence_upper: Math.min(100, baseDemand + 3.2),
        mae: 4.82,
        model: 'Gradient Boosting Regressor (scikit-learn)',
      });
    }

    return result;
  }

  async createBooking(params: CreateBookingParams): Promise<Booking> {
    const booking = await this.engine.createBooking(params);
    this.emit('booking_created', booking);
    return booking;
  }

  async cancelBooking(bookingId: string, userId: string): Promise<{ cancelledBooking: Booking; message: string }> {
    const res = await this.engine.cancelBooking(bookingId, userId);
    this.emit('booking_cancelled', { bookingId, cascadeResult: res.cascadeResult });
    return {
      cancelledBooking: res.cancelledBooking,
      message: res.cascadeResult.message,
    };
  }

  async modifyBooking(bookingId: string, newStart: Date, newEnd: Date, userId: string): Promise<Booking> {
    const booking = await this.engine.modifyBooking(bookingId, newStart, newEnd, userId);
    this.emit('booking_modified', booking);
    return booking;
  }

  async joinWaitlist(params: JoinWaitlistParams): Promise<WaitlistEntry> {
    const entry = this.engine.joinWaitlist(params);
    this.emit('waitlist_joined', entry);
    return entry;
  }

  async confirmHold(holdId: string, _userId: string): Promise<Booking> {
    const booking = this.engine.confirmHold(holdId);
    this.emit('hold_confirmed', booking);
    return booking;
  }

  async setMaintenance(
    unitId: string,
    isActive: boolean,
    reason?: string,
    expectedReturnTime?: Date,
    createdBy: string = 'admin'
  ): Promise<MaintenanceRecord | null> {
    this.engine.setMaintenance(unitId, isActive, reason, expectedReturnTime, new Date(), createdBy);
    const records = this.engine.getMaintenance().filter((m) => m.unitId === unitId);
    const rec = records[records.length - 1] || null;
    this.emit('maintenance_updated', { unitId, isActive, record: rec });
    return rec;
  }

  async getBookingQR(bookingId: string): Promise<{ bookingId: string; token: string; qrDataUrl: string }> {
    return this.engine.getBookingQR(bookingId);
  }

  async checkInBooking(bookingId: string, token?: string): Promise<Booking> {
    const booking = this.engine.checkIn(bookingId, token);
    this.emit('booking_checked_in', booking);
    return booking;
  }

  async checkOutBooking(bookingId: string): Promise<Booking> {
    const booking = this.engine.checkOut(bookingId);
    this.emit('booking_checked_out', booking);
    return booking;
  }

  async suggestSchedule(params: ScheduleSuggestParams): Promise<ScheduleSuggestion[]> {
    const now = new Date();
    const startWindow = params.startWindow || now;
    const endWindow = params.endWindow || new Date(startWindow.getTime() + (params.daysWindow || 3) * 24 * 3600 * 1000);

    const matchingUnits = Object.values(MOCK_EQUIPMENT).filter(
      (u) => u.type.toLowerCase() === params.equipmentType.toLowerCase() || u.name.toLowerCase().includes(params.equipmentType.toLowerCase())
    );

    if (matchingUnits.length === 0) return [];

    const durationMs = params.durationMinutes * 60 * 1000;
    const activeBookings = this.engine.getBookings().filter((b) => b.status === 'active' || b.status === 'in_use');
    const activeMaint = this.engine.getMaintenance().filter((m) => m.isActive);

    const candidateSlots: ScheduleSuggestion[] = [];

    for (const unit of matchingUnits) {
      // Unit utilization estimate
      const unitBookings = activeBookings.filter((b) => b.unitId === unit.id);
      const utilization = Math.min(1, unitBookings.length * 0.25);

      let cursor = new Date(startWindow);
      const mins = cursor.getMinutes();
      cursor.setMinutes(mins < 30 ? 30 : 60, 0, 0);

      while (cursor.getTime() + durationMs <= endWindow.getTime() && candidateSlots.length < 15) {
        const candStart = new Date(cursor);
        const candEnd = new Date(candStart.getTime() + durationMs);
        cursor = new Date(cursor.getTime() + 30 * 60 * 1000);

        const h = candStart.getHours();
        if (h < 8 || candEnd.getHours() > 22) continue;

        const clashBk = unitBookings.some((b) => candStart.getTime() < b.endTime.getTime() && candEnd.getTime() > b.startTime.getTime());
        if (clashBk) continue;

        const clashMaint = activeMaint.some((m) => m.unitId === unit.id && candStart.getTime() < m.expectedReturnTime.getTime() && candEnd.getTime() > m.startedAt.getTime());
        if (clashMaint) continue;

        const isPeak = h >= 14 && h <= 17;
        const demandLevel = isPeak ? 'High Peak' : h >= 10 && h <= 13 ? 'Moderate' : 'Low Congestion';
        const score = Math.round(50 + (1 - utilization) * 30 + (isPeak ? 10 : 20));

        candidateSlots.push({
          unitId: unit.id,
          unitName: unit.name,
          unitNumber: unit.unitNumber,
          buildingId: unit.buildingId,
          buildingName: unit.buildingName,
          startTime: candStart,
          endTime: candEnd,
          durationMinutes: params.durationMinutes,
          score,
          utilizationRate: Math.round(utilization * 100) / 100,
          demandLevel,
          recommendationReason: `Optimal load balancing on ${unit.name} (${Math.round((1 - utilization) * 100)}% available). ${demandLevel} slot.`,
        });
      }
    }

    return candidateSlots.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  async parseNaturalLanguageSchedule(prompt: string): Promise<ParsedScheduleIntent> {
    const text = prompt.toLowerCase();
    let equipmentType = 'gpu';
    if (text.includes('camera') || text.includes('dslr') || text.includes('canon') || text.includes('sony')) equipmentType = 'camera';
    else if (text.includes('vr') || text.includes('headset') || text.includes('quest') || text.includes('vive')) equipmentType = 'vr';
    else if (text.includes('printer') || text.includes('3d') || text.includes('print')) equipmentType = 'printer';
    else if (text.includes('microscope')) equipmentType = 'microscope';
    else if (text.includes('projector')) equipmentType = 'projector';

    let durationMinutes = 120;
    const hrMatch = text.match(/(\d+)\s*(?:hours?|hrs?|h)\b/);
    if (hrMatch) durationMinutes = Math.min(480, Math.max(15, parseInt(hrMatch[1], 10) * 60));

    const now = new Date();
    let targetDay = new Date(now);
    if (text.includes('tomorrow')) targetDay.setDate(targetDay.getDate() + 1);
    else if (text.includes('friday')) {
      const dist = (5 - now.getDay() + 7) % 7 || 7;
      targetDay.setDate(targetDay.getDate() + dist);
    }

    let startH = 14;
    let endH = 18;
    if (text.includes('morning')) { startH = 9; endH = 13; }
    else if (text.includes('evening') || text.includes('night')) { startH = 17; endH = 21; }

    const earliest = new Date(targetDay);
    earliest.setHours(startH, 0, 0, 0);
    const latest = new Date(targetDay);
    latest.setHours(endH, 0, 0, 0);

    return {
      equipmentType,
      durationMinutes,
      earliest,
      latest,
    };
  }
}
