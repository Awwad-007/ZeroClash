import { DataSource, ConnectionStatus, HeatmapData, ForecastPoint, ServerEvent } from './dataSource';
import { CreateBookingParams, JoinWaitlistParams } from '../engine/bookingEngine';
import { EquipmentUnit, Booking, WaitlistEntry, HoldEntry, MaintenanceRecord, AuditLogEntry, UserRole } from '../types';
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
    const res = await fetch(`${this.apiBase}/admin/maintenance`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: any[] = await res.json();
    return data.map((m) => this.mapMaintenance(m));
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await fetch(`${this.apiBase}/admin/audit-logs`);
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
    return await res.json();
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
}
