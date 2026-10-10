import { Building, EquipmentUnit, EquipmentStatus, BuildingColorTheme, BuildingArchitecturalType } from './types';

/**
 * Raw input representation of an equipment item from an external host application.
 */
export interface RawEquipmentInput {
  id: string;
  name: string;
  unitNumber?: string;
  /** Equipment category (e.g. 'camera', 'gpu', 'vr', 'microscope', 'printer', 'projector', 'labkit', 'device') */
  type?: string;
  /** Public asset path or URL for icon. If omitted, resolved automatically from `type`. */
  iconUrl?: string;
  buildingId: string;
  buildingName: string;
  /** Explicit status flag or override */
  status?: EquipmentStatus;
  /** Optional precomputed status string */
  statusText?: string;
  /** Flag indicating if unit is under maintenance */
  isMaintenance?: boolean;
  /** Details for currently ongoing reservation, if any */
  activeBooking?: {
    userName?: string;
    userRole?: string;
    startTime?: Date | string;
    endTime?: Date | string;
  };
  /** Details for upcoming reservation, if any */
  nextBooking?: {
    userName?: string;
    startTime?: Date | string;
    endTime?: Date | string;
  };
  /** Hardware or unit specifications */
  specs?: {
    model?: string;
    resolution?: string;
    vram?: string;
    features?: string;
    [key: string]: string | undefined;
  };
  /** Search keywords or tags */
  aliases?: string[];
}

/**
 * Raw input representation of a building from an external host application.
 */
export interface RawBuildingInput {
  id: string;
  name: string;
  code?: string;
  category?: 'science' | 'media' | 'library' | 'annex' | 'archive' | string;
  colorTheme?: BuildingColorTheme;
  neonColor?: string;
  fillColor?: string;
  /** 3D world position [x, y, z] */
  position?: [number, number, number];
  /** 3D world size [width, height, depth] */
  size?: [number, number, number];
  rotation?: [number, number, number];
  architecturalType?: BuildingArchitecturalType;
  /** List of equipment unit IDs housed in this building */
  equipmentIds?: string[];
}

/**
 * Maps known equipment type keys to the standard 8 exported icons.
 */
export function resolveEquipmentIcon(type?: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('cam')) return '/assets/icons/camera.png';
  if (t.includes('gpu') || t.includes('cuda') || t.includes('compute')) return '/assets/icons/gpu.png';
  if (t.includes('vr') || t.includes('xr') || t.includes('headset') || t.includes('quest')) return '/assets/icons/vr.png';
  if (t.includes('micro') || t.includes('scope')) return '/assets/icons/microscope.png';
  if (t.includes('print')) return '/assets/icons/printer.png';
  if (t.includes('proj')) return '/assets/icons/projector.png';
  if (t.includes('lab') || t.includes('kit')) return '/assets/icons/labkit.png';
  return '/assets/icons/device.png';
}

/**
 * Derives the visual EquipmentStatus and user-friendly statusText from simple booking fields.
 */
export function deriveEquipmentStatus(options: {
  isMaintenance?: boolean;
  statusOverride?: EquipmentStatus;
  statusTextOverride?: string;
  activeBooking?: { userName?: string; endTime?: Date | string };
  nextBooking?: { userName?: string; startTime?: Date | string; endTime?: Date | string };
}): { status: EquipmentStatus; statusText: string } {
  const { isMaintenance, statusOverride, statusTextOverride, activeBooking, nextBooking } = options;

  if (statusOverride) {
    return {
      status: statusOverride,
      statusText: statusTextOverride || (statusOverride === 'available' ? 'AVAILABLE' : statusOverride.toUpperCase()),
    };
  }

  if (isMaintenance) {
    return {
      status: 'maintenance',
      statusText: statusTextOverride || 'MAINTENANCE - Inactive',
    };
  }

  if (activeBooking && activeBooking.endTime) {
    const endStr =
      activeBooking.endTime instanceof Date
        ? activeBooking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : String(activeBooking.endTime);
    const userStr = activeBooking.userName ? ` (${activeBooking.userName})` : '';
    return {
      status: 'booked',
      statusText: statusTextOverride || `IN USE until ${endStr}${userStr}`,
    };
  }

  if (nextBooking && nextBooking.startTime) {
    const startStr =
      nextBooking.startTime instanceof Date
        ? nextBooking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : String(nextBooking.startTime);
    return {
      status: 'available',
      statusText: statusTextOverride || `AVAILABLE until ${startStr}`,
    };
  }

  return {
    status: 'available',
    statusText: statusTextOverride || 'AVAILABLE now',
  };
}

/**
 * Adapts an external host equipment record into the 3D map's EquipmentUnit interface.
 */
export function toMapEquipment(raw: RawEquipmentInput): EquipmentUnit {
  const { status, statusText } = deriveEquipmentStatus({
    isMaintenance: raw.isMaintenance,
    statusOverride: raw.status,
    statusTextOverride: raw.statusText,
    activeBooking: raw.activeBooking,
    nextBooking: raw.nextBooking,
  });

  const nextBookingObj = raw.nextBooking
    ? {
        startTime:
          raw.nextBooking.startTime instanceof Date
            ? raw.nextBooking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : String(raw.nextBooking.startTime || ''),
        endTime:
          raw.nextBooking.endTime instanceof Date
            ? raw.nextBooking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : String(raw.nextBooking.endTime || ''),
        userName: raw.nextBooking.userName || 'Reserved',
      }
    : undefined;

  const currentBookingObj = raw.activeBooking
    ? {
        startTime:
          raw.activeBooking.startTime instanceof Date
            ? raw.activeBooking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : String(raw.activeBooking.startTime || ''),
        endTime:
          raw.activeBooking.endTime instanceof Date
            ? raw.activeBooking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : String(raw.activeBooking.endTime || ''),
        userName: raw.activeBooking.userName || 'Active User',
        userRole: raw.activeBooking.userRole,
      }
    : undefined;

  return {
    id: raw.id,
    name: raw.name,
    unitNumber: raw.unitNumber || `#${raw.id.slice(-2)}`,
    type: raw.type || 'device',
    iconUrl: raw.iconUrl || resolveEquipmentIcon(raw.type),
    buildingId: raw.buildingId,
    buildingName: raw.buildingName,
    status,
    statusText,
    currentBooking: currentBookingObj,
    nextBooking: nextBookingObj,
    specs: {
      model: raw.specs?.model || raw.name,
      resolution: raw.specs?.resolution,
      vram: raw.specs?.vram,
      features: raw.specs?.features,
    },
    aliases: raw.aliases || [raw.name.toLowerCase()],
  };
}

/**
 * Adapts an external host building record into the 3D map's Building interface.
 */
export function toMapBuilding(raw: RawBuildingInput, defaultIndex = 0): Building {
  const fallbackThemes: BuildingColorTheme[] = ['cyan', 'green', 'orange', 'dark-blue'];
  const theme = raw.colorTheme || fallbackThemes[defaultIndex % fallbackThemes.length];

  const themeNeons: Record<BuildingColorTheme, { neon: string; fill: string }> = {
    cyan: { neon: '#00e5ff', fill: '#0284c7' },
    green: { neon: '#22c55e', fill: '#15803d' },
    orange: { neon: '#f97316', fill: '#c2410c' },
    'dark-blue': { neon: '#0284c7', fill: '#0f172a' },
  };

  return {
    id: raw.id,
    name: raw.name,
    code: raw.code || raw.id.toUpperCase(),
    category: raw.category || 'science',
    colorTheme: theme,
    neonColor: raw.neonColor || themeNeons[theme].neon,
    fillColor: raw.fillColor || themeNeons[theme].fill,
    position: raw.position || [defaultIndex * 4 - 6, 0, (defaultIndex % 2) * 4 - 2],
    size: raw.size || [6.5, 4.0, 6.0],
    rotation: raw.rotation || [0, 0, 0],
    architecturalType: raw.architecturalType || 'science-wing',
    equipmentIds: raw.equipmentIds || [],
  };
}

/**
 * Helper to adapt an array of raw equipment items.
 */
export function toMapEquipmentList(items: RawEquipmentInput[]): EquipmentUnit[] {
  return items.map(toMapEquipment);
}

/**
 * Helper to adapt an array of raw building items.
 */
export function toMapBuildingList(items: RawBuildingInput[]): Building[] {
  return items.map((item, idx) => toMapBuilding(item, idx));
}
