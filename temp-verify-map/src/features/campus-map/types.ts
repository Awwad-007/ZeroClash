export type EquipmentStatus = 'available' | 'booked' | 'maintenance';

export type BuildingColorTheme = 'cyan' | 'green' | 'orange' | 'dark-blue';

export type BuildingArchitecturalType =
  | 'science-wing'
  | 'stepped-annex'
  | 'media-hall'
  | 'classical-library'
  | 'cube-archive';

export interface BookingSummary {
  startTime: string;
  endTime: string;
  userName: string;
  userRole?: string;
  purpose?: string;
}

export interface EquipmentUnit {
  id: string;
  name: string;
  unitNumber: string;
  type: 'camera' | 'gpu' | 'vr' | 'microscope' | 'printer' | 'projector' | 'labkit' | 'device' | string;
  iconUrl: string;
  buildingId: string;
  buildingName: string;
  status: EquipmentStatus;
  statusText: string;
  currentBooking?: BookingSummary;
  nextBooking?: BookingSummary;
  specs: {
    model: string;
    resolution?: string;
    vram?: string;
    features?: string;
    [key: string]: string | undefined;
  };
  aliases: string[];
}

export interface Building {
  id: string;
  name: string;
  code: string;
  category: 'science' | 'media' | 'library' | 'annex' | 'archive' | string;
  colorTheme: BuildingColorTheme;
  neonColor: string;
  fillColor: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  architecturalType: BuildingArchitecturalType;
  equipmentIds: string[];
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'local';

export interface CampusMapProps {
  /** Optional custom buildings array. If omitted, falls back to mock campus buildings. */
  buildings?: Building[];
  /** Optional custom equipment array or dictionary. If omitted, falls back to mock equipment. */
  equipment?: EquipmentUnit[] | Record<string, EquipmentUnit>;
  /** Callback fired when user clicks "Book Slot" in the equipment modal */
  onBookSlot?: (unitId: string) => void;
  /** Callback fired when user clicks "Join Waitlist" in the equipment modal */
  onJoinWaitlist?: (unitId: string) => void;
  /** Callback fired when an equipment pin or building is selected */
  onSelectUnit?: (unitId: string) => void;
  /** Callback fired when user clicks the scroll indicator chevron */
  onScrollDown?: () => void;
  /** Additional CSS class names for the outer 100vh hero container */
  className?: string;
  /** Header title text (defaults to 'Smart Campus Hub') */
  title?: string;
  /** Header system/version badge text (defaults to 'ZeroClash v2.4') */
  badgeText?: string;
  /** Connection status pill display */
  connectionStatus?: ConnectionStatus;
  /** Whether to show the top header and search bar (default: true) */
  showHeader?: boolean;
  /** Whether to show the status legend at bottom left (default: true) */
  showLegend?: boolean;
  /** Whether to show viewport controls at bottom right (default: true) */
  showControls?: boolean;
  /** Whether to show the scroll-down indicator at bottom center (default: true) */
  showScrollIndicator?: boolean;
}
