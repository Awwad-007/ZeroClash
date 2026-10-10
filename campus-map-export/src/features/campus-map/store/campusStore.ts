import { create } from 'zustand';
import { Building, EquipmentUnit, ConnectionStatus } from '../types';
import { MOCK_BUILDINGS, MOCK_EQUIPMENT } from '../mockData';

export interface CampusStoreState {
  buildings: Building[];
  equipment: Record<string, EquipmentUnit>;
  searchQuery: string;
  matchingBuildingIds: string[];
  matchingUnitIds: string[];
  selectedBuildingId: string | null;
  selectedUnitId: string | null;
  isModalOpen: boolean;
  showGrid: boolean;
  wireframeOnly: boolean;
  cameraZoom: number;
  cameraTarget: [number, number, number];
  pulseBuildingId: string | null;
  connectionStatus: ConnectionStatus;

  // Actions
  setBuildings: (buildings: Building[]) => void;
  setEquipment: (equipment: EquipmentUnit[] | Record<string, EquipmentUnit>) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSearchQuery: (query: string) => void;
  selectUnit: (unitId: string | null) => void;
  selectBuilding: (buildingId: string | null) => void;
  openModal: (unitId: string) => void;
  closeModal: () => void;
  setCameraZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleGrid: () => void;
  toggleWireframe: () => void;
  resetCamera: () => void;
  triggerBuildingPulse: (buildingId: string) => void;
}

const DEFAULT_TARGET: [number, number, number] = [-0.5, 0, -1.8];
const DEFAULT_ZOOM = 28;

function normalizeEquipment(
  equip: EquipmentUnit[] | Record<string, EquipmentUnit>
): Record<string, EquipmentUnit> {
  if (Array.isArray(equip)) {
    const dict: Record<string, EquipmentUnit> = {};
    for (const unit of equip) {
      dict[unit.id] = unit;
    }
    return dict;
  }
  return equip;
}

export const useCampusStore = create<CampusStoreState>((set, get) => ({
  buildings: MOCK_BUILDINGS,
  equipment: MOCK_EQUIPMENT,
  searchQuery: '',
  matchingBuildingIds: MOCK_BUILDINGS.map((b) => b.id),
  matchingUnitIds: Object.keys(MOCK_EQUIPMENT),
  selectedBuildingId: null,
  selectedUnitId: null,
  isModalOpen: false,
  showGrid: true,
  wireframeOnly: false,
  cameraZoom: DEFAULT_ZOOM,
  cameraTarget: DEFAULT_TARGET,
  pulseBuildingId: null,
  connectionStatus: 'connected',

  setBuildings: (buildings: Building[]) => {
    const { searchQuery, equipment } = get();
    set({ buildings });
    if (!searchQuery) {
      set({ matchingBuildingIds: buildings.map((b) => b.id) });
    } else {
      get().setSearchQuery(searchQuery);
    }
  },

  setEquipment: (rawEquip: EquipmentUnit[] | Record<string, EquipmentUnit>) => {
    const normalized = normalizeEquipment(rawEquip);
    set({ equipment: normalized });
    const { searchQuery } = get();
    if (!searchQuery) {
      set({ matchingUnitIds: Object.keys(normalized) });
    } else {
      get().setSearchQuery(searchQuery);
    }
  },

  setConnectionStatus: (connectionStatus: ConnectionStatus) => {
    set({ connectionStatus });
  },

  setSearchQuery: (query: string) => {
    const { equipment, buildings } = get();
    const q = query.trim().toLowerCase();

    if (!q) {
      set({
        searchQuery: '',
        matchingBuildingIds: buildings.map((b) => b.id),
        matchingUnitIds: Object.keys(equipment),
        cameraTarget: DEFAULT_TARGET,
      });
      return;
    }

    const matchedUnits = Object.values(equipment).filter((unit) => {
      const matchName = unit.name.toLowerCase().includes(q);
      const matchType = unit.type.toLowerCase().includes(q);
      const matchBldg = unit.buildingName.toLowerCase().includes(q);
      const matchAliases = unit.aliases?.some((alias) => alias.toLowerCase().includes(q)) ?? false;
      const matchNum = unit.unitNumber.toLowerCase().includes(q);
      return matchName || matchType || matchBldg || matchAliases || matchNum;
    });

    const matchedUnitIds = matchedUnits.map((u) => u.id);
    const matchedBldgIdsFromUnits = matchedUnits.map((u) => u.buildingId);

    const matchedBuildings = buildings.filter((bldg) => {
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

  selectUnit: (unitId: string | null) => {
    if (!unitId) {
      set({ selectedUnitId: null, isModalOpen: false });
      return;
    }
    const { equipment, buildings } = get();
    const unit = equipment[unitId];
    if (unit) {
      const bldg = buildings.find((b) => b.id === unit.buildingId);
      set({
        selectedUnitId: unitId,
        selectedBuildingId: unit.buildingId,
        isModalOpen: true,
        cameraTarget: bldg ? [bldg.position[0], 0, bldg.position[2]] : DEFAULT_TARGET,
      });
    }
  },

  selectBuilding: (buildingId: string | null) => {
    if (!buildingId) {
      set({ selectedBuildingId: null });
      return;
    }
    const { buildings } = get();
    const bldg = buildings.find((b) => b.id === buildingId);
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
    const { equipment, buildings } = get();
    set({
      cameraTarget: DEFAULT_TARGET,
      cameraZoom: DEFAULT_ZOOM,
      searchQuery: '',
      matchingBuildingIds: buildings.map((b) => b.id),
      matchingUnitIds: Object.keys(equipment),
    });
  },

  triggerBuildingPulse: (buildingId: string) => {
    set({ pulseBuildingId: buildingId });
    setTimeout(() => {
      if (get().pulseBuildingId === buildingId) {
        set({ pulseBuildingId: null });
      }
    }, 2500);
  },
}));
