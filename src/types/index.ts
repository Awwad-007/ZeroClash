export type UserRole = 'Student' | 'Faculty' | 'Researcher' | 'Lab Admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  department: string;
  noShowCount: number;
  reliabilityScore: number; // 0 - 100
}

export type BookingStatus = 'active' | 'cancelled' | 'completed';

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface Booking {
  id: string;
  unitId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  startTime: Date;
  endTime: Date;
  purpose: string;
  status: BookingStatus;
  createdAt: Date;
}

export type WaitlistStatus = 'waiting' | 'on_hold' | 'promoted' | 'expired' | 'cancelled';

export interface WaitlistEntry {
  id: string;
  unitId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  startTime: Date;
  endTime: Date;
  urgency: 'low' | 'medium' | 'high';
  purpose: string;
  priorityScore: number;
  scoreBreakdown: {
    roleScore: number;
    urgencyScore: number;
    reliabilityScore: number;
  };
  status: WaitlistStatus;
  requestedAt: Date;
  holdExpiresAt?: Date;
  holdId?: string;
}

export interface HoldEntry {
  id: string;
  waitlistEntryId: string;
  unitId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  startTime: Date;
  endTime: Date;
  heldAt: Date;
  expiresAt: Date;
  confirmed: boolean;
  expired: boolean;
}

export interface MaintenanceRecord {
  id: string;
  unitId: string;
  isActive: boolean;
  reason: string;
  expectedReturnTime: Date;
  startedAt: Date;
  cancelledBookingIds: string[];
}

export type EquipmentStatus = 'available' | 'booked' | 'maintenance';

export interface EquipmentUnit {
  id: string;
  name: string;
  unitNumber: string;
  type: 'camera' | 'gpu' | 'vr' | 'microscope' | 'printer' | 'projector' | 'labkit' | 'device';
  iconUrl: string;
  buildingId: string;
  buildingName: string;
  status: EquipmentStatus;
  statusText: string;
  currentBooking?: Booking;
  nextBooking?: {
    startTime: string;
    endTime: string;
    userName: string;
  };
  specs: {
    model: string;
    resolution?: string;
    vram?: string;
    features?: string;
  };
  aliases: string[];
}

export interface Building {
  id: string;
  name: string;
  code: string;
  category: 'science' | 'media' | 'library' | 'annex' | 'archive';
  colorTheme: 'cyan' | 'green' | 'orange' | 'dark-blue';
  neonColor: string;
  fillColor: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  architecturalType: 'science-wing' | 'stepped-annex' | 'media-hall' | 'classical-library' | 'cube-archive';
  equipmentIds: string[];
}

export interface AuditLogEntry {
  id: string;
  action: 'CREATE_BOOKING' | 'CANCEL_BOOKING' | 'MODIFY_BOOKING' | 'WAITLIST_HOLD' | 'HOLD_CONFIRMED' | 'HOLD_EXPIRED' | 'SET_MAINTENANCE' | 'CLEAR_MAINTENANCE';
  targetId: string;
  details: string;
  timestamp: Date;
  userId: string;
}
