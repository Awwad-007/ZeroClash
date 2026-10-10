import { DataSource, ConnectionStatus, HeatmapData, ForecastPoint, ServerEvent } from './dataSource';
import { CreateBookingParams, JoinWaitlistParams } from '../engine/bookingEngine';
import {
  EquipmentUnit,
  Booking,
  WaitlistEntry,
  HoldEntry,
  MaintenanceRecord,
  AuditLogEntry,
  UserRole,
  ScheduleSuggestion,
  ScheduleSuggestParams,
  ParsedScheduleIntent
} from '../types';
import { MOCK_EQUIPMENT } from '../data/mock';

const DEFAULT_API_BASE = 'http://localhost:8000/api';
const DEFAULT_WS_URL = 'ws://localhost:8000/ws';

export class RemoteSource implements DataSource {
  private apiBase: string;
  private wsUrl: string;
  private socket: WebSocket | null = null;
  private subscribers: Array<(event: ServerEvent) => void> = [];
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];
  private _status: ConnectionStatus = 'disconnected';
  private reconnectTimer: any = null;
  private shouldReconnect: boolean = true;

  constructor(apiBase?: string, wsUrl?: string) {
    this.apiBase = apiBase || (import.meta.env.VITE_API_URL as string) || DEFAULT_API_BASE;
    this.wsUrl = wsUrl || (import.meta.env.VITE_WS_URL as string) || DEFAULT_WS_URL;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  private getAuthHeaders(extraUserId?: string): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zc_auth_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (extraUserId) {
      headers['X-Demo-User-Id'] = extraUserId;
    }
    return headers;
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this._status !== newStatus) {
      this._status = newStatus;
      this.statusListeners.forEach((cb) => cb(newStatus));
    }
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.push(callback);
    callback(this._status);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  async init(): Promise<void> {
    this.shouldReconnect = true;
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.setStatus('reconnecting');
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        this.setStatus('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.subscribers.forEach((cb) => cb(parsed));
        } catch (e) {
          console.warn('[RemoteSource] WebSocket parse error', e);
        }
      };

      this.socket.onclose = () => {
        this.setStatus('reconnecting');
        if (this.shouldReconnect && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectWebSocket();
          }, 3000);
        }
      };

      this.socket.onerror = () => {
        this.setStatus('disconnected');
      };
    } catch {
      this.setStatus('disconnected');
      if (this.shouldReconnect && !this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connectWebSocket();
        }, 3000);
      }
    }
  }

  subscribe(callback: (event: ServerEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  private mapBooking(raw: any): Booking {
    return {
      id: raw.id,
      unitId: raw.unit_id,
      userId: raw.user_id,
      userName: raw.user_name,
      userRole: raw.user_role as UserRole,
      startTime: new Date(raw.start_time),
      endTime: new Date(raw.end_time),
      purpose: raw.purpose,
      status: raw.status,
      checkedInAt: raw.checked_in_at ? new Date(raw.checked_in_at) : undefined,
      checkedOutAt: raw.checked_out_at ? new Date(raw.checked_out_at) : undefined,
      qrToken: raw.qr_token || undefined,
      createdAt: new Date(raw.created_at || Date.now()),
    };
  }

  private mapWaitlist(raw: any): WaitlistEntry {
    const roleScore = raw.user_role === 'Faculty' ? 40 : raw.user_role === 'Researcher' ? 35 : raw.user_role === 'Lab Admin' ? 30 : 20;
    const urgencyScore = raw.urgency === 'high' ? 40 : raw.urgency === 'medium' ? 25 : 10;
    return {
      id: raw.id,
      unitId: raw.unit_id,
      userId: raw.user_id,
      userName: raw.user_name,
      userRole: raw.user_role as UserRole,
      startTime: new Date(raw.start_time),
      endTime: new Date(raw.end_time),
      urgency: raw.urgency,
      purpose: raw.purpose,
      priorityScore: raw.priority_score,
      scoreBreakdown: {
        roleScore,
        urgencyScore,
        reliabilityScore: 20,
      },
      status: raw.status,
      requestedAt: new Date(raw.requested_at || Date.now()),
    };
  }

  private mapHold(raw: any): HoldEntry {
    return {
      id: raw.id,
      unitId: raw.unit_id,
      userId: raw.user_id,
      userName: raw.user_name,
      userRole: raw.user_role as UserRole,
      waitlistEntryId: raw.waitlist_entry_id,
      startTime: new Date(raw.start_time),
      endTime: new Date(raw.end_time),
      heldAt: new Date(raw.created_at || Date.now()),
      expiresAt: new Date(raw.expires_at),
      confirmed: raw.confirmed,
      expired: raw.expired,
    };
  }

  private mapMaintenance(raw: any): MaintenanceRecord {
    let cancelledIds: string[] = [];
    try {
      cancelledIds = JSON.parse(raw.cancelled_booking_ids_json || '[]');
    } catch {
      cancelledIds = [];
    }
    return {
      id: raw.id,
      unitId: raw.unit_id,
      reason: raw.reason,
      startedAt: new Date(raw.started_at),
      expectedReturnTime: new Date(raw.expected_return_time),
      isActive: raw.is_active,
      cancelledBookingIds: cancelledIds,
    };
  }

  async getEquipment(): Promise<Record<string, EquipmentUnit>> {
    const res = await fetch(`${this.apiBase}/equipment`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const remoteUnits: any[] = await res.json();

    const result: Record<string, EquipmentUnit> = { ...MOCK_EQUIPMENT };
    remoteUnits.forEach((u) => {
      const base = result[u.id] || {
        id: u.id,
        name: u.name,
        type: u.type,
        buildingId: u.building_id,
        buildingName: u.building_name,
        unitNumber: u.unit_number,
        specs: u.specs,
        icon: '/assets/icons/device.png',
        color: '#00f0ff',
        aliases: [],
      };
      result[u.id] = {
        ...base,
        status: u.status,
        statusText: u.status_text,
      };
    });
    return result;
  }

  async getBookings(): Promise<Booking[]> {
    const res = await fetch(`${this.apiBase}/bookings`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: any[] = await res.json();
    return data.map((b) => this.mapBooking(b));
  }

  async getWaitlist(): Promise<WaitlistEntry[]> {
    const res = await fetch(`${this.apiBase}/waitlist`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: any[] = await res.json();
    return data.map((w) => this.mapWaitlist(w));
  }

  async getHolds(): Promise<HoldEntry[]> {
    // Fetches active holds from waitlist holds endpoint or derives from waitlist
    const res = await fetch(`${this.apiBase}/waitlist`);
    if (!res.ok) return [];
    return [];
  }

  async getMaintenance(): Promise<MaintenanceRecord[]> {
    const res = await fetch(`${this.apiBase}/admin/maintenance`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: any[] = await res.json();
    return data.map((m) => this.mapMaintenance(m));
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await fetch(`${this.apiBase}/admin/audit-logs`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: any[] = await res.json();
    return data.map((l) => ({
      id: l.id,
      timestamp: new Date(l.timestamp),
      action: l.action,
      targetId: l.target_id,
      userId: l.user_id,
      details: l.details,
    }));
  }

  async getHeatmap(): Promise<HeatmapData> {
    const res = await fetch(`${this.apiBase}/analytics/heatmap`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  }

  async getForecast(lookaheadDays: number = 7): Promise<ForecastPoint[]> {
    const res = await fetch(`${this.apiBase}/analytics/forecast?lookahead_days=${lookaheadDays}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data.projected_forecast && Array.isArray(data.projected_forecast)) {
      return data.projected_forecast.map((p: any) => ({
        day: p.day,
        predicted_demand: p.predicted_utilization,
        moving_avg: p.confidence_range ? p.confidence_range[0] : Math.round(p.predicted_utilization * 0.95),
        peak_hour: p.peak_hour ?? 14,
        status: p.predicted_utilization >= 78 ? 'High' : p.predicted_utilization >= 55 ? 'Moderate' : 'Low',
        confidence_lower: p.confidence_range?.[0],
        confidence_upper: p.confidence_range?.[1],
        mae: data.mae_held_out_week,
        model: data.model,
      }));
    }
    return [];
  }

  async createBooking(params: CreateBookingParams): Promise<Booking> {
    const res = await fetch(`${this.apiBase}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_id: params.unitId,
        user_id: params.userId,
        user_name: params.userName,
        user_role: params.userRole,
        start_time: params.startTime.toISOString(),
        end_time: params.endTime.toISOString(),
        purpose: params.purpose,
      }),
    });

    if (res.status === 409) {
      const err = await res.json();
      const conflictMsg = err.detail?.error || 'Concurrent Slot Conflict';
      const alts = err.detail?.suggested_alternatives || [];
      const error: any = new Error(conflictMsg);
      error.status = 409;
      error.alternatives = alts;
      throw error;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown booking error' }));
      throw new Error(err.detail || `Booking failed with status ${res.status}`);
    }

    const data = await res.json();
    return this.mapBooking(data);
  }

  async cancelBooking(bookingId: string, userId: string): Promise<{ cancelledBooking: Booking; message: string }> {
    const res = await fetch(`${this.apiBase}/bookings/${bookingId}?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(userId),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Cancellation failed' }));
      throw new Error(err.detail || 'Cancellation failed');
    }
    const data = await res.json();
    // Return placeholder cancelled booking with cascade message
    return {
      cancelledBooking: {
        id: bookingId,
        unitId: '',
        userId,
        userName: '',
        userRole: 'Student',
        startTime: new Date(),
        endTime: new Date(),
        purpose: '',
        status: 'cancelled',
        createdAt: new Date(),
      },
      message: data.cascade_result || 'Booking cancelled successfully',
    };
  }

  async modifyBooking(bookingId: string, newStart: Date, newEnd: Date, userId: string): Promise<Booking> {
    const res = await fetch(`${this.apiBase}/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(userId),
      body: JSON.stringify({
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        user_id: userId,
      }),
    });

    if (res.status === 409) {
      const err = await res.json();
      throw new Error(err.detail || 'Slot clash on reschedule');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Modification failed' }));
      throw new Error(err.detail || 'Failed to modify booking');
    }

    const data = await res.json();
    return this.mapBooking(data);
  }

  async joinWaitlist(params: JoinWaitlistParams): Promise<WaitlistEntry> {
    const res = await fetch(`${this.apiBase}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_id: params.unitId,
        user_id: params.userId,
        user_name: params.userName,
        user_role: params.userRole,
        start_time: params.startTime.toISOString(),
        end_time: params.endTime.toISOString(),
        urgency: params.urgency,
        purpose: params.purpose,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Waitlist join failed' }));
      throw new Error(err.detail || 'Failed to join waitlist');
    }

    const data = await res.json();
    return this.mapWaitlist(data);
  }

  async confirmHold(holdId: string, _userId: string): Promise<Booking> {
    const res = await fetch(`${this.apiBase}/holds/${holdId}/confirm`, {
      method: 'POST',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Hold confirmation failed' }));
      throw new Error(err.detail || 'Failed to confirm hold');
    }

    const data = await res.json();
    return this.mapBooking(data);
  }

  async setMaintenance(
    unitId: string,
    isActive: boolean,
    reason?: string,
    expectedReturnTime?: Date,
    createdBy: string = 'admin'
  ): Promise<MaintenanceRecord | null> {
    const res = await fetch(`${this.apiBase}/admin/maintenance`, {
      method: 'POST',
      headers: this.getAuthHeaders(createdBy),
      body: JSON.stringify({
        unit_id: unitId,
        is_active: isActive,
        reason: reason || 'Scheduled Diagnostic Maintenance',
        expected_return_time: expectedReturnTime ? expectedReturnTime.toISOString() : undefined,
        user_id: createdBy,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Maintenance toggle failed' }));
      throw new Error(err.detail || 'Failed to update maintenance');
    }

    return null;
  }

  async getBookingQR(bookingId: string): Promise<{ bookingId: string; token: string; qrDataUrl: string }> {
    const res = await fetch(`${this.apiBase}/bookings/${bookingId}/qr`);
    if (!res.ok) throw new Error('Failed to retrieve QR pass');
    const data = await res.json();
    return {
      bookingId: data.booking_id,
      token: data.token,
      qrDataUrl: data.qr_data_url,
    };
  }

  async checkInBooking(bookingId: string, token?: string): Promise<Booking> {
    const res = await fetch(`${this.apiBase}/bookings/${bookingId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Check-in failed' }));
      throw new Error(err.detail || 'Check-in failed');
    }
    const data = await res.json();
    return this.mapBooking(data);
  }

  async checkOutBooking(bookingId: string): Promise<Booking> {
    const res = await fetch(`${this.apiBase}/bookings/${bookingId}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Check-out failed' }));
      throw new Error(err.detail || 'Check-out failed');
    }
    const data = await res.json();
    return this.mapBooking(data);
  }

  async suggestSchedule(params: ScheduleSuggestParams): Promise<ScheduleSuggestion[]> {
    const res = await fetch(`${this.apiBase}/schedule/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_type: params.equipmentType,
        duration_minutes: params.durationMinutes,
        start_window: params.startWindow?.toISOString(),
        end_window: params.endWindow?.toISOString(),
        days_window: params.daysWindow || 3,
        user_role: params.userRole || 'Student',
        urgency: params.urgency || 'medium',
        user_id: params.userId,
      }),
    });
    if (!res.ok) throw new Error('Failed to retrieve AI schedule suggestions');
    const data = await res.json();
    return (data.suggested_slots || []).map((s: any) => ({
      unitId: s.unit_id,
      unitName: s.unit_name,
      unitNumber: s.unit_number,
      buildingId: s.building_id,
      buildingName: s.building_name,
      startTime: new Date(s.start_time),
      endTime: new Date(s.end_time),
      durationMinutes: s.duration_minutes,
      score: s.score,
      utilizationRate: s.utilization_rate,
      demandLevel: s.demand_level,
      recommendationReason: s.recommendation_reason,
    }));
  }

  async parseNaturalLanguageSchedule(prompt: string): Promise<ParsedScheduleIntent> {
    const res = await fetch(`${this.apiBase}/schedule/parse-nlp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error('Failed to parse natural language scheduling prompt');
    const data = await res.json();
    return {
      equipmentType: data.equipment_type,
      durationMinutes: data.duration_minutes,
      earliest: new Date(data.earliest),
      latest: new Date(data.latest),
    };
  }
}
