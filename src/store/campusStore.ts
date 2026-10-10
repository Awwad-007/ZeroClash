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
  UserRole,
} from '../types';
import { BookingEngine, CreateBookingParams, JoinWaitlistParams } from '../engine/bookingEngine';
import { SEED_USERS, SEED_BOOKINGS, SEED_WAITLIST, SEED_MAINTENANCE } from '../data/seedData';
import { checkAvailability } from '../engine/conflict';

// Global singleton instance of BookingEngine with seeded realistic state
const initialEngine = new BookingEngine({
  bookings: SEED_BOOKINGS,
  waitlist: SEED_WAITLIST,
  holds: [],
  maintenance: SEED_MAINTENANCE,
  auditLogs: [],
});

function deriveAllEquipment(engine: BookingEngine, currentTime: Date = new Date()): Record<string, EquipmentUnit> {
  const result: Record<string, EquipmentUnit> = {};
  for (const [id, baseUnit] of Object.entries(MOCK_EQUIPMENT)) {
    const derived = engine.deriveUnitStatus(baseUnit, currentTime);
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

  // Engine Actions
  createBooking: (params: Omit<CreateBookingParams, 'userId' | 'userName' | 'userRole'>) => Promise<Booking>;
  cancelBooking: (bookingId: string) => Promise<{ cancelledBooking: Booking; message: string }>;
  modifyBooking: (bookingId: string, newStart: Date, newEnd: Date) => Promise<Booking>;
  joinWaitlist: (params: Omit<JoinWaitlistParams, 'userId' | 'userName' | 'userRole'>) => WaitlistEntry;
  confirmHold: (holdId: string) => Booking;
  setMaintenance: (unitId: string, isActive: boolean, reason?: string, expectedReturnTime?: Date) => void;
  refreshState: () => void;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

const DEFAULT_TARGET: [number, number, number] = [-0.5, 0, -1.8];
const DEFAULT_ZOOM = 28;

export const useCampusStore = create<CampusState>((set, get) => {
  const initialEquip = deriveAllEquipment(initialEngine);

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

    engine: initialEngine,
    equipment: initialEquip,
    currentUser: SEED_USERS[0], // Alex M. (Student)
    allUsers: SEED_USERS,
    bookings: initialEngine.getBookings(),
    waitlist: initialEngine.getWaitlist(),
    holds: initialEngine.getHolds(),
    maintenance: initialEngine.getMaintenance(),
    auditLogs: initialEngine.getAuditLogs(),

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
      const { engine } = get();
      const updatedEquip = deriveAllEquipment(engine);
      set({
        equipment: updatedEquip,
        bookings: engine.getBookings(),
        waitlist: engine.getWaitlist(),
        holds: engine.getHolds(),
        maintenance: engine.getMaintenance(),
        auditLogs: engine.getAuditLogs(),
      });
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
      const { engine, currentUser, triggerBuildingPulse, refreshState, equipment, addToast } = get();
      const unit = equipment[params.unitId];

      const newBooking = await engine.createBooking({
        ...params,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
      });

      refreshState();
      if (unit) {
        triggerBuildingPulse(unit.buildingId);
        addToast({
          type: 'success',
          title: 'Booking Confirmed',
          message: `${unit.name} ${unit.unitNumber} reserved until ${newBooking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        });
      }
      return newBooking;
    },

    cancelBooking: async (bookingId: string) => {
      const { engine, currentUser, refreshState, addToast } = get();
      const res = await engine.cancelBooking(bookingId, currentUser.id);
      refreshState();
      addToast({
        type: 'info',
        title: 'Booking Cancelled',
        message: res.cascadeResult.message,
      });
      return {
        cancelledBooking: res.cancelledBooking,
        message: res.cascadeResult.message,
      };
    },

    modifyBooking: async (bookingId: string, newStart: Date, newEnd: Date) => {
      const { engine, currentUser, refreshState, equipment, triggerBuildingPulse, addToast } = get();
      const modified = await engine.modifyBooking(bookingId, newStart, newEnd, currentUser.id);
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
    },

    joinWaitlist: (params) => {
      const { engine, currentUser, refreshState, addToast, equipment } = get();
      const unit = equipment[params.unitId];
      const entry = engine.joinWaitlist({
        ...params,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        noShowCount: currentUser.noShowCount,
      });
      refreshState();
      addToast({
        type: 'success',
        title: 'Added to Priority Waitlist',
        message: `Ranked with priority score ${entry.priorityScore}/100 for ${unit?.name || 'unit'}. Automated cascade active.`,
      });
      return entry;
    },

    confirmHold: (holdId: string) => {
      const { engine, refreshState, equipment, triggerBuildingPulse, addToast } = get();
      const booking = engine.confirmHold(holdId);
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

    setMaintenance: (unitId: string, isActive: boolean, reason?: string, expectedReturnTime?: Date) => {
      const { engine, currentUser, refreshState, equipment, triggerBuildingPulse } = get();
      engine.setMaintenance(unitId, isActive, reason, expectedReturnTime, new Date(), currentUser.id);
      refreshState();
      const unit = equipment[unitId];
      if (unit) {
        triggerBuildingPulse(unit.buildingId);
      }
    },
  };
});
