import { create } from 'zustand';
import { MOCK_BUILDINGS, MOCK_EQUIPMENT, EquipmentUnit, Building } from '../data/mock';

interface CampusState {
  searchQuery: string;
  selectedUnitId: string | null;
  selectedBuildingId: string | null;
  isModalOpen: boolean;
  showGrid: boolean;
  wireframeOnly: boolean;
  cameraZoom: number;
  cameraTarget: [number, number, number];
  
  matchingBuildingIds: string[];
  matchingUnitIds: string[];
  
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
}

const DEFAULT_TARGET: [number, number, number] = [-0.5, 0, -1.8];
const DEFAULT_ZOOM = 28;

export const useCampusStore = create<CampusState>((set, get) => ({
  searchQuery: '',
  // Default to eq-cam-04 open on Media Lab (matching reference UI Image 2)
  selectedUnitId: 'eq-cam-04',
  selectedBuildingId: 'bldg-media-1',
  isModalOpen: true,
  showGrid: true,
  wireframeOnly: false,
  cameraZoom: DEFAULT_ZOOM,
  cameraTarget: DEFAULT_TARGET,
  
  matchingBuildingIds: MOCK_BUILDINGS.map((b) => b.id),
  matchingUnitIds: Object.keys(MOCK_EQUIPMENT),

  setSearchQuery: (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      set({
        searchQuery: '',
        matchingBuildingIds: MOCK_BUILDINGS.map((b) => b.id),
        matchingUnitIds: Object.keys(MOCK_EQUIPMENT),
        cameraTarget: DEFAULT_TARGET,
      });
      return;
    }

    const matchedUnits = Object.values(MOCK_EQUIPMENT).filter((unit) => {
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

    // Compute center of matching buildings to frame them smoothly
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
    const unit = MOCK_EQUIPMENT[unitId];
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
    set({
      cameraTarget: DEFAULT_TARGET,
      cameraZoom: DEFAULT_ZOOM,
      searchQuery: '',
      matchingBuildingIds: MOCK_BUILDINGS.map((b) => b.id),
      matchingUnitIds: Object.keys(MOCK_EQUIPMENT),
    });
  },
}));
