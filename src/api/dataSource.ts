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
import { CreateBookingParams, JoinWaitlistParams } from '../engine/bookingEngine';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'local';

export interface HeatmapData {
  heatmap: Record<string, number[]>;
  days: string[];
  hours: number[];
}

export interface ForecastPoint {
  day: string;
  predicted_demand: number;
  moving_avg: number;
  peak_hour: number;
  status: string;
}

export interface ServerEvent {
  event: string;
  data: any;
  timestamp?: string;
}

export interface DataSource {
  readonly status: ConnectionStatus;

  init(): Promise<void>;
  subscribe(callback: (event: ServerEvent) => void): () => void;
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void;

  getEquipment(): Promise<Record<string, EquipmentUnit>>;
  getBookings(): Promise<Booking[]>;
  getWaitlist(): Promise<WaitlistEntry[]>;
  getHolds(): Promise<HoldEntry[]>;
  getMaintenance(): Promise<MaintenanceRecord[]>;
  getAuditLogs(): Promise<AuditLogEntry[]>;
  getHeatmap(): Promise<HeatmapData>;
  getForecast(lookaheadDays?: number): Promise<ForecastPoint[]>;

  createBooking(params: CreateBookingParams): Promise<Booking>;
  cancelBooking(bookingId: string, userId: string): Promise<{ cancelledBooking: Booking; message: string }>;
  modifyBooking(bookingId: string, newStart: Date, newEnd: Date, userId: string): Promise<Booking>;
  joinWaitlist(params: JoinWaitlistParams): Promise<WaitlistEntry>;
  confirmHold(holdId: string, userId: string): Promise<Booking>;
  setMaintenance(unitId: string, isActive: boolean, reason?: string, expectedReturnTime?: Date, createdBy?: string): Promise<MaintenanceRecord | null>;

  getBookingQR(bookingId: string): Promise<{ bookingId: string; token: string; qrDataUrl: string }>;
  checkInBooking(bookingId: string, token?: string): Promise<Booking>;
  checkOutBooking(bookingId: string): Promise<Booking>;

  suggestSchedule(params: ScheduleSuggestParams): Promise<ScheduleSuggestion[]>;
  parseNaturalLanguageSchedule(prompt: string): Promise<ParsedScheduleIntent>;
}
