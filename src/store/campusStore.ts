import { create } from 'zustand';
import { MOCK_BUILDINGS, MOCK_EQUIPMENT } from '../data/mock';
import {
  EquipmentUnit,
  Building,
  User,
  Booking,
  WaitlistEntry,
  HoldEntry,
  MaintenanceRecord,
  AuditLogEntry,
} from '../types';
import { BookingEngine, CreateBookingParams, JoinWaitlistParams } from '../engine/bookingEngine';
import { SEED_USERS, SEED_BOOKINGS, SEED_WAITLIST, SEED_MAINTENANCE } from '../data/seedData';
import { dataSource, ConnectionStatus, ServerEvent } from '../api';

// Initial fallback engine for purely local derivations
const localFallbackEngine = new BookingEngine({
  bookings: [...SEED_BOOKINGS],
  waitlist: [...SEED_WAITLIST],
  holds: [],
  maintenance: [...SEED_MAINTENANCE],
  auditLogs: [],
});

function deriveAllEquipment(
  bookings: Booking[],
  maintenance: MaintenanceRecord[],
  currentTime: Date = new Date()
): Record<string, EquipmentUnit> {
  const result: Record<string, EquipmentUnit> = {};
  const tempEngine = new BookingEngine({
    bookings,
    waitlist: [],
    holds: [],
    maintenance,
    auditLogs: [],
  });

  for (const [id, baseUnit] of Object.entries(MOCK_EQUIPMENT)) {
    const derived = tempEngine.deriveUnitStatus(baseUnit, currentTime);
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

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface CampusState {
  // Navigation & 3D scene state
  searchQuery: string;
  selectedUnitId: string | null;
  selectedBuildingId: string | null;
  isModalOpen: boolean;
  showGrid: boolean;
  wireframeOnly: boolean;
  cameraZoom: number;
  cameraTarget: [number, number, number];
  pulseBuildingId: string | null;

  matchingBuildingIds: string[];
  matchingUnitIds: string[];

  // Connection & DataSource
  connectionStatus: ConnectionStatus;

  // Reactive Data & Engine state
  engine: BookingEngine;
  equipment: Record<string, EquipmentUnit>;
  currentUser: User;
  allUsers: User[];
  bookings: Booking[];
  waitlist: WaitlistEntry[];
  holds: HoldEntry[];
  maintenance: MaintenanceRecord[];
  auditLogs: AuditLogEntry[];

  // "My Bookings" drawer state
  isMyBookingsOpen: boolean;
  toasts: Toast[];

  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Actions
  setSearchQuery: (query: string) => void;
  selectUnit: (unitId: string) => void;
  selectBuilding: (buildingId: string) => void;
  openModal: (unitId: string) => void;
  closeModal: () => void;
  setCameraZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleGrid: () => void;
  toggleWireframe: () => void;
  resetCamera: () => void;

  // User actions
  setCurrentUser: (user: User) => void;
  setIsMyBookingsOpen: (open: boolean) => void;
  triggerBuildingPulse: (bldgId: string) => void;

  // Engine Actions (optimistic UI with rollback)
  createBooking: (params: Omit<CreateBookingParams, 'userId' | 'userName' | 'userRole'>) => Promise<Booking>;
  cancelBooking: (bookingId: string) => Promise<{ cancelledBooking: Booking; message: string }>;
  modifyBooking: (bookingId: string, newStart: Date, newEnd: Date) => Promise<Booking>;
  joinWaitlist: (params: Omit<JoinWaitlistParams, 'userId' | 'userName' | 'userRole'>) => Promise<WaitlistEntry>;
  confirmHold: (holdId: string) => Promise<Booking>;
  setMaintenance: (unitId: string, isActive: boolean, reason?: string, expectedReturnTime?: Date) => Promise<void>;
  getBookingQR: (bookingId: string) => Promise<{ bookingId: string; token: string; qrDataUrl: string }>;
  checkInBooking: (bookingId: string, qrToken?: string) => Promise<Booking>;
  checkOutBooking: (bookingId: string) => Promise<Booking>;
  refreshState: () => void;
}

const DEFAULT_TARGET: [number, number, number] = [-0.5, 0, -1.8];
const DEFAULT_ZOOM = 28;

export const useCampusStore = create<CampusState>((set, get) => {
  const initialEquip = deriveAllEquipment(SEED_BOOKINGS, SEED_MAINTENANCE);

  // Subscribe to dataSource status changes
  dataSource.onStatusChange((status) => {
    set({ connectionStatus: status });
  });

  // Subscribe to live WebSocket / engine events
  dataSource.subscribe((event: ServerEvent) => {
    const { bookings, maintenance, refreshState, addToast, equipment } = get();
    if (event.event === 'booking_created' && event.data) {
      const b = event.data;
      const parsedBooking: Booking = {
        id: b.id,
        unitId: b.unit_id || b.unitId,
        userId: b.user_id || b.userId,
        userName: b.user_name || b.userName,
        userRole: b.user_role || b.userRole,
        startTime: new Date(b.start_time || b.startTime),
        endTime: new Date(b.end_time || b.endTime),
        purpose: b.purpose,
        status: b.status,
        createdAt: new Date(b.created_at || b.createdAt || Date.now()),
      };
      if (!bookings.some((existing) => existing.id === parsedBooking.id)) {
        set((state) => ({ bookings: [...state.bookings, parsedBooking] }));
        refreshState();
      }
    } else if (event.event === 'booking_cancelled' && event.data) {
      const cancelledId = event.data.booking_id || event.data.bookingId;
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === cancelledId ? { ...b, status: 'cancelled' } : b)),
      }));
      refreshState();
    } else if (event.event === 'booking_checked_in' && event.data) {
      const checkedInId = event.data.booking_id || event.data.bookingId;
      set((state) => ({
        bookings: state.bookings.map((b) =>
          b.id === checkedInId
            ? {
                ...b,
                status: 'in_use',
                checkedInAt: event.data.checked_in_at ? new Date(event.data.checked_in_at) : new Date(),
              }
            : b
        ),
      }));
      refreshState();
    } else if (event.event === 'booking_checked_out' && event.data) {
      const checkedOutId = event.data.booking_id || event.data.bookingId;
      set((state) => ({
        bookings: state.bookings.map((b) =>
          b.id === checkedOutId
            ? {
                ...b,
                status: 'completed',
                checkedOutAt: event.data.checked_out_at ? new Date(event.data.checked_out_at) : new Date(),
              }
            : b
        ),
      }));
      refreshState();
    } else if (event.event === 'maintenance_changed' || event.event === 'maintenance_updated') {
      refreshState();
    }
  });

  // Initialize data source in background
  dataSource.init().catch((err) => {
    console.warn('[CampusStore] DataSource init warning:', err);
  });

  return {
    searchQuery: '',
    selectedUnitId: 'eq-cam-04',
    selectedBuildingId: 'bldg-media-1',
    isModalOpen: true,
    showGrid: true,
    wireframeOnly: false,
    cameraZoom: DEFAULT_ZOOM,
    cameraTarget: DEFAULT_TARGET,
    pulseBuildingId: null,

    matchingBuildingIds: MOCK_BUILDINGS.map((b) => b.id),
    matchingUnitIds: Object.keys(initialEquip),

    connectionStatus: dataSource.status,

    engine: localFallbackEngine,
    equipment: initialEquip,
    currentUser: SEED_USERS[0], // Alex M. (Student)
    allUsers: SEED_USERS,
    bookings: [...SEED_BOOKINGS],
    waitlist: [...SEED_WAITLIST],
    holds: [],
    maintenance: [...SEED_MAINTENANCE],
    auditLogs: [],

    isMyBookingsOpen: false,
    toasts: [],

    addToast: (toast) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: Toast = { ...toast, id, duration: toast.duration ?? 4500 };
      set((state) => ({ toasts: [...state.toasts, newToast] }));
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    },

    removeToast: (id) => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    },

    refreshState: () => {
      const { bookings, maintenance } = get();
      const updatedEquip = deriveAllEquipment(bookings, maintenance);
      set({ equipment: updatedEquip });
    },

    setSearchQuery: (query: string) => {
      const { equipment } = get();
      const q = query.trim().toLowerCase();
      if (!q) {
        set({
          searchQuery: '',
          matchingBuildingIds: MOCK_BUILDINGS.map((b) => b.id),
          matchingUnitIds: Object.keys(equipment),
          cameraTarget: DEFAULT_TARGET,
        });
        return;
      }

      const matchedUnits = Object.values(equipment).filter((unit) => {
        const matchName = unit.name.toLowerCase().includes(q);
        const matchType = unit.type.toLowerCase().includes(q);
        const matchBldg = unit.buildingName.toLowerCase().includes(q);
        const matchAliases = unit.aliases.some((alias) => alias.toLowerCase().includes(q));
        const matchNum = unit.unitNumber.toLowerCase().includes(q);
        return matchName || matchType || matchBldg || matchAliases || matchNum;
      });

      const matchedUnitIds = matchedUnits.map((u) => u.id);
      const matchedBldgIdsFromUnits = matchedUnits.map((u) => u.buildingId);

      const matchedBuildings = MOCK_BUILDINGS.filter((bldg) => {
        const matchName = bldg.name.toLowerCase().includes(q);
        const matchCode = bldg.code.toLowerCase().includes(q);
        const hasMatchedUnit = matchedBldgIdsFromUnits.includes(bldg.id);
        return matchName || matchCode || hasMatchedUnit;
      });

      const matchedBuildingIds = matchedBuildings.map((b) => b.id);

      let newTarget: [number, number, number] = DEFAULT_TARGET;
      if (matchedBuildings.length > 0) {
        const avgX = matchedBuildings.reduce((acc, b) => acc + b.position[0], 0) / matchedBuildings.length;
        const avgZ = matchedBuildings.reduce((acc, b) => acc + b.position[2], 0) / matchedBuildings.length;
        newTarget = [avgX, 0, avgZ];
      }

      set({
        searchQuery: query,
        matchingBuildingIds: matchedBuildingIds,
        matchingUnitIds: matchedUnitIds,
        cameraTarget: newTarget,
      });
    },

    selectUnit: (unitId: string) => {
      const { equipment } = get();
      const unit = equipment[unitId];
      if (unit) {
        const bldg = MOCK_BUILDINGS.find((b) => b.id === unit.buildingId);
        set({
          selectedUnitId: unitId,
          selectedBuildingId: unit.buildingId,
          isModalOpen: true,
          cameraTarget: bldg ? [bldg.position[0], 0, bldg.position[2]] : DEFAULT_TARGET,
        });
      }
    },

    selectBuilding: (buildingId: string) => {
      const bldg = MOCK_BUILDINGS.find((b) => b.id === buildingId);
      if (bldg) {
        const firstUnit = bldg.equipmentIds.length > 0 ? bldg.equipmentIds[0] : null;
        set({
          selectedBuildingId: buildingId,
          selectedUnitId: firstUnit,
          isModalOpen: firstUnit !== null,
          cameraTarget: [bldg.position[0], 0, bldg.position[2]],
        });
      }
    },

    openModal: (unitId: string) => {
      set({ selectedUnitId: unitId, isModalOpen: true });
    },

    closeModal: () => {
      set({ isModalOpen: false });
    },

    setCameraZoom: (zoom: number) => {
      set({ cameraZoom: Math.min(65, Math.max(16, zoom)) });
    },

    zoomIn: () => {
      const { cameraZoom } = get();
      set({ cameraZoom: Math.min(65, cameraZoom + 6) });
    },

    zoomOut: () => {
      const { cameraZoom } = get();
      set({ cameraZoom: Math.max(16, cameraZoom - 6) });
    },

    toggleGrid: () => {
      set((state) => ({ showGrid: !state.showGrid }));
    },

    toggleWireframe: () => {
      set((state) => ({ wireframeOnly: !state.wireframeOnly }));
    },

    resetCamera: () => {
      const { equipment } = get();
      set({
        cameraTarget: DEFAULT_TARGET,
        cameraZoom: DEFAULT_ZOOM,
        searchQuery: '',
        matchingBuildingIds: MOCK_BUILDINGS.map((b) => b.id),
        matchingUnitIds: Object.keys(equipment),
      });
    },

    setCurrentUser: (user: User) => {
      set({ currentUser: user });
    },

    setIsMyBookingsOpen: (open: boolean) => {
      set({ isMyBookingsOpen: open });
    },

    triggerBuildingPulse: (bldgId: string) => {
      set({ pulseBuildingId: bldgId });
      setTimeout(() => {
        if (get().pulseBuildingId === bldgId) {
          set({ pulseBuildingId: null });
        }
      }, 2500);
    },

    createBooking: async (params) => {
      const { currentUser, triggerBuildingPulse, refreshState, equipment, addToast } = get();
      const unit = equipment[params.unitId];

      // Optimistic booking insertion
      const optimisticId = `opt-${Date.now()}`;
      const optimisticBooking: Booking = {
        id: optimisticId,
        unitId: params.unitId,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        startTime: params.startTime,
        endTime: params.endTime,
        purpose: params.purpose,
        status: 'active',
        createdAt: new Date(),
      };

      set((state) => ({ bookings: [...state.bookings, optimisticBooking] }));
      refreshState();

      try {
        const confirmedBooking = await dataSource.createBooking({
          ...params,
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
        });

        // Swap optimistic ID with confirmed booking
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === optimisticId ? confirmedBooking : b)),
        }));
        refreshState();

        if (unit) {
          triggerBuildingPulse(unit.buildingId);
          addToast({
            type: 'success',
            title: 'Booking Confirmed',
            message: `${unit.name} ${unit.unitNumber} reserved until ${confirmedBooking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          });
        }
        return confirmedBooking;
      } catch (err: any) {
        // Rollback optimistic state
        set((state) => ({
          bookings: state.bookings.filter((b) => b.id !== optimisticId),
        }));
        refreshState();

        addToast({
          type: 'error',
          title: err.status === 409 ? 'Slot Conflict (409)' : 'Booking Failed',
          message: err.message || 'The requested slot clashes with another active reservation.',
          duration: 5500,
        });
        throw err;
      }
    },

    cancelBooking: async (bookingId: string) => {
      const { currentUser, refreshState, addToast, bookings } = get();
      const target = bookings.find((b) => b.id === bookingId);

      // Optimistic cancel
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)),
      }));
      refreshState();

      try {
        const res = await dataSource.cancelBooking(bookingId, currentUser.id);
        refreshState();
        addToast({
          type: 'info',
          title: 'Booking Cancelled',
          message: res.message,
        });
        return res;
      } catch (err: any) {
        // Rollback if cancellation fails
        if (target) {
          set((state) => ({
            bookings: state.bookings.map((b) => (b.id === bookingId ? target : b)),
          }));
          refreshState();
        }
        addToast({
          type: 'error',
          title: 'Cancellation Failed',
          message: err.message || 'Could not cancel booking.',
        });
        throw err;
      }
    },

    modifyBooking: async (bookingId: string, newStart: Date, newEnd: Date) => {
      const { currentUser, refreshState, equipment, triggerBuildingPulse, addToast, bookings } = get();
      const original = bookings.find((b) => b.id === bookingId);
      if (!original) throw new Error('Booking not found');

      // Optimistic modify
      set((state) => ({
        bookings: state.bookings.map((b) =>
          b.id === bookingId ? { ...b, startTime: newStart, endTime: newEnd } : b
        ),
      }));
      refreshState();

      try {
        const modified = await dataSource.modifyBooking(bookingId, newStart, newEnd, currentUser.id);
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === bookingId ? modified : b)),
        }));
        refreshState();

        const unit = equipment[modified.unitId];
        if (unit) {
          triggerBuildingPulse(unit.buildingId);
          addToast({
            type: 'success',
            title: 'Reservation Rescheduled',
            message: `${unit.name} shifted to ${newStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${newEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          });
        }
        return modified;
      } catch (err: any) {
        // Rollback to original interval
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === bookingId ? original : b)),
        }));
        refreshState();

        addToast({
          type: 'error',
          title: 'Reschedule Conflict (409)',
          message: err.message || 'Requested time window conflicts with another user.',
        });
        throw err;
      }
    },

    joinWaitlist: async (params) => {
      const { currentUser, refreshState, addToast, equipment } = get();
      const unit = equipment[params.unitId];
      const entry = await dataSource.joinWaitlist({
        ...params,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        noShowCount: currentUser.noShowCount,
      });

      set((state) => ({ waitlist: [...state.waitlist, entry] }));
      refreshState();

      addToast({
        type: 'success',
        title: 'Added to Priority Waitlist',
        message: `Ranked with priority score ${entry.priorityScore}/100 for ${unit?.name || 'unit'}. Automated cascade active.`,
      });
      return entry;
    },

    confirmHold: async (holdId: string) => {
      const { currentUser, refreshState, equipment, triggerBuildingPulse, addToast } = get();
      const booking = await dataSource.confirmHold(holdId, currentUser.id);

      set((state) => ({
        bookings: [...state.bookings, booking],
        holds: state.holds.map((h) => (h.id === holdId ? { ...h, confirmed: true } : h)),
      }));
      refreshState();

      const unit = equipment[booking.unitId];
      if (unit) {
        triggerBuildingPulse(unit.buildingId);
        addToast({
          type: 'success',
          title: 'Hold Confirmed',
          message: `Provisional hold activated into confirmed reservation for ${unit.name} ${unit.unitNumber}!`,
        });
      }
      return booking;
    },

    setMaintenance: async (unitId: string, isActive: boolean, reason?: string, expectedReturnTime?: Date) => {
      const { currentUser, refreshState, equipment, triggerBuildingPulse } = get();
      const rec = await dataSource.setMaintenance(unitId, isActive, reason, expectedReturnTime, currentUser.id);

      if (isActive && rec) {
        set((state) => ({
          maintenance: [...state.maintenance.filter((m) => m.unitId !== unitId), rec],
        }));
      } else {
        set((state) => ({
          maintenance: state.maintenance.map((m) => (m.unitId === unitId ? { ...m, isActive: false } : m)),
        }));
      }

      refreshState();
      const unit = equipment[unitId];
      if (unit) {
        triggerBuildingPulse(unit.buildingId);
      }
    },

    getBookingQR: async (bookingId: string) => {
      return await dataSource.getBookingQR(bookingId);
    },

    checkInBooking: async (bookingId: string, qrToken?: string) => {
      const { refreshState, addToast, equipment, triggerBuildingPulse } = get();
      try {
        const updated = await dataSource.checkInBooking(bookingId, qrToken);
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)),
        }));
        refreshState();
        const unit = equipment[updated.unitId];
        if (unit) {
          triggerBuildingPulse(unit.buildingId);
        }
        addToast({
          type: 'success',
          title: 'Checked In Successfully',
          message: `Session for ${unit?.name || 'unit'} is now IN USE. Enjoy your slot!`,
        });
        return updated;
      } catch (err: any) {
        addToast({
          type: 'error',
          title: 'Check-in Denied',
          message: err.message || 'Check-in is only allowed between 10m before start and 15m after.',
        });
        throw err;
      }
    },

    checkOutBooking: async (bookingId: string) => {
      const { refreshState, addToast, equipment, triggerBuildingPulse } = get();
      try {
        const updated = await dataSource.checkOutBooking(bookingId);
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)),
        }));
        refreshState();
        const unit = equipment[updated.unitId];
        if (unit) {
          triggerBuildingPulse(unit.buildingId);
        }
        addToast({
          type: 'info',
          title: 'Checked Out',
          message: `Session for ${unit?.name || 'unit'} completed. Any remaining time has been returned to campus inventory.`,
        });
        return updated;
      } catch (err: any) {
        addToast({
          type: 'error',
          title: 'Check-out Failed',
          message: err.message || 'Failed to complete session check-out.',
        });
        throw err;
      }
    },
  };
});
