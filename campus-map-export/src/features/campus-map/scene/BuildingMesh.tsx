import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Building } from '../types';
import { useCampusStore } from '../store/campusStore';

interface BuildingMeshProps {
  building: Building;
}

export const BuildingMesh: React.FC<BuildingMeshProps> = ({ building }) => {
  const [hovered, setHovered] = useState(false);
  const selectedBuildingId = useCampusStore((s) => s.selectedBuildingId);
  const matchingBuildingIds = useCampusStore((s) => s.matchingBuildingIds);
  const selectBuilding = useCampusStore((s) => s.selectBuilding);
  const equipment = useCampusStore((s) => s.equipment);
  const pulseBuildingId = useCampusStore((s) => s.pulseBuildingId);

  const isSelected = selectedBuildingId === building.id;
  const isMatch = matchingBuildingIds.includes(building.id);
  const isPulsing = pulseBuildingId === building.id;

  // Status computation for building edge color
  const statusColor = useMemo(() => {
    if (isPulsing) return '#00f0ff'; // Bright cyan flash on booking success
    if (building.equipmentIds.length === 0) {
      return building.neonColor;
    }
    const units = building.equipmentIds.map((id) => equipment[id]).filter(Boolean);
    const hasMaintenance = units.some((u) => u.status === 'maintenance');
    const allBooked = units.length > 0 && units.every((u) => u.status === 'booked');
    const hasAvailable = units.some((u) => u.status === 'available');

    if (allBooked) return '#ef4444'; // Red
    if (hasMaintenance) return '#eab308'; // Yellow
    if (hasAvailable) return building.neonColor;
    return building.neonColor;
  }, [building, equipment, isPulsing]);

  const [w, h, d] = building.size;

  // Real, rich architectural color palette - solid, non-transparent materials
  const wallColor = useMemo(() => {
    if (!isMatch) return '#0b1120'; // Muted dark slate when search filter dims
    if (hovered || isSelected) {
      switch (building.colorTheme) {
        case 'cyan':
          return '#162b3d';
        case 'green':
          return '#163326';
        case 'orange':
          return '#382216';
        case 'dark-blue':
        default:
          return '#1b2a4a';
      }
    }
    // Default rich dark architectural concrete
    switch (building.colorTheme) {
      case 'cyan':
        return '#0f2030';
      case 'green':
        return '#0f261c';
      case 'orange':
        return '#261710';
      case 'dark-blue':
      default:
        return '#111c30';
    }
  }, [building.colorTheme, isMatch, hovered, isSelected]);

  // Window emission colors
  const windowEmissiveColor = useMemo(() => {
    if (!isMatch) return '#0284c7';
    switch (building.colorTheme) {
      case 'cyan':
        return '#38bdf8';
      case 'green':
        return '#4ade80';
      case 'orange':
        return '#fb923c';
      case 'dark-blue':
      default:
        return '#60a5fa';
    }
  }, [building.colorTheme, isMatch]);

  // Precompute windows layout
  const windows = useMemo(() => {
    const list: { pos: [number, number, number]; size: [number, number, number]; isLit: boolean }[] = [];
    const floors = 3;
    const windowCols = 5;
    const colSpacing = (w * 0.8) / windowCols;
    const floorHeight = (h * 0.75) / floors;

    // Front facade windows (Z = d/2 + 0.02)
    for (let f = 0; f < floors; f++) {
      const y = -h * 0.3 + f * floorHeight;
      for (let c = 0; c < windowCols; c++) {
        // Skip central ground window where entrance door is
        if (f === 0 && c === Math.floor(windowCols / 2)) continue;
        const x = -w * 0.4 + (c + 0.5) * colSpacing;
        const isLit = (f + c) % 2 === 0 || f === floors - 1;
        list.push({
          pos: [x, y, d / 2 + 0.02],
          size: [colSpacing * 0.65, floorHeight * 0.48, 0.04],
          isLit,
        });
      }
    }

    // Side facade windows (X = w/2 + 0.02)
    const sideCols = 3;
    const sideSpacing = (d * 0.75) / sideCols;
    for (let f = 0; f < floors; f++) {
      const y = -h * 0.3 + f * floorHeight;
      for (let c = 0; c < sideCols; c++) {
        const z = -d * 0.35 + (c + 0.5) * sideSpacing;
        const isLit = (f + c) % 3 !== 0;
        list.push({
          pos: [w / 2 + 0.02, y, z],
          size: [0.04, floorHeight * 0.48, sideSpacing * 0.65],
          isLit,
        });
      }
    }

    return list;
  }, [w, h, d]);

  // Precompute edges geometry for high-tech architectural accents
  const edgesGeo = useMemo(() => {
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  }, [w, h, d]);

  return (
    <group
      position={building.position}
      rotation={building.rotation || [0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        selectBuilding(building.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (typeof document !== 'undefined') {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        if (typeof document !== 'undefined') {
          document.body.style.cursor = 'default';
        }
      }}
    >
      {/* 1. SOLID FOUNDATION PLINTH (Base ground slab) */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[w + 0.5, 0.2, d + 0.5]} />
        <meshStandardMaterial color="#080e18" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* 2. MAIN SOLID BUILDING MASS (Opaque, Solid architectural block) */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.65}
          metalness={0.25}
          emissive={isSelected ? statusColor : '#000000'}
          emissiveIntensity={isSelected ? 0.15 : 0}
        />
      </mesh>

      {/* 3. SHARP CRISP ACCENT EDGES */}
      <lineSegments geometry={edgesGeo} position={[0, h / 2, 0]}>
        <lineBasicMaterial
          color={statusColor}
          transparent
          opacity={isMatch ? (hovered || isSelected ? 0.95 : 0.65) : 0.2}
          linewidth={1.5}
        />
      </lineSegments>

      {/* 4. RECESSED ROOFTOP SLAB */}
      <mesh position={[0, h + 0.02, 0]} receiveShadow>
        <boxGeometry args={[w - 0.25, 0.05, d - 0.25]} />
        <meshStandardMaterial color="#070c14" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* 5. SOLID ROOF PARAPET BORDER WALLS (North, South, East, West rims) */}
      {/* Front parapet (+Z) */}
      <mesh position={[0, h + 0.12, d / 2 - 0.08]} castShadow>
        <boxGeometry args={[w, 0.24, 0.16]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Back parapet (-Z) */}
      <mesh position={[0, h + 0.12, -d / 2 + 0.08]} castShadow>
        <boxGeometry args={[w, 0.24, 0.16]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Left parapet (-X) */}
      <mesh position={[-w / 2 + 0.08, h + 0.12, 0]} castShadow>
        <boxGeometry args={[0.16, 0.24, d - 0.32]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Right parapet (+X) */}
      <mesh position={[w / 2 - 0.08, h + 0.12, 0]} castShadow>
        <boxGeometry args={[0.16, 0.24, d - 0.32]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* 6. SOLID ROOF DETAILS (Elevator Penthouse, HVAC Chiller Units, Antenna) */}
      {/* Rooftop Elevator/Mechanical Penthouse Box */}
      <group position={[-w * 0.2, h + 0.45, -d * 0.15]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w * 0.38, 0.7, d * 0.38]} />
          <meshStandardMaterial color="#101827" roughness={0.6} metalness={0.4} />
        </mesh>
        {/* Penthouse roof trim */}
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[w * 0.42, 0.06, d * 0.42]} />
          <meshStandardMaterial color="#0369a1" emissive={statusColor} emissiveIntensity={0.2} />
        </mesh>
      </group>

      {/* Dual Rooftop HVAC Chiller Units with fans */}
      <group position={[w * 0.22, h + 0.25, -d * 0.2]}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.38, 0.65]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Chiller fan cylinder */}
        <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.08, 12]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
      </group>

      <group position={[w * 0.22, h + 0.25, d * 0.2]}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.38, 0.65]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.08, 12]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
      </group>

      {/* Communication Antenna Mast with glowing red beacon sphere */}
      <group position={[-w * 0.32, h + 0.8, d * 0.28]}>
        {/* Antenna rod */}
        <mesh>
          <cylinderGeometry args={[0.03, 0.05, 1.4, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Crossbar */}
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.3, 0.03, 0.03]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        {/* Glowing top beacon */}
        <mesh position={[0, 0.72, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* 7. ILLUMINATED WINDOW PANELS (Solid, backlit architectural glass) */}
      {windows.map((win, idx) => (
        <mesh
          key={idx}
          position={[win.pos[0], win.pos[1] + h / 2, win.pos[2]]}
        >
          <boxGeometry args={win.size} />
          <meshStandardMaterial
            color={win.isLit ? '#1e3a5f' : '#0a101d'}
            emissive={win.isLit ? windowEmissiveColor : '#000000'}
            emissiveIntensity={win.isLit ? (isMatch ? 0.75 : 0.25) : 0}
            roughness={0.2}
            metalness={0.5}
          />
        </mesh>
      ))}

      {/* 8. SOLID GROUND ENTRANCE ARCHITECTURE */}
      {/* Entrance Portico / Lobby Box */}
      <group position={[0, h * 0.22, d / 2 + 0.2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w * 0.32, h * 0.44, 0.4]} />
          <meshStandardMaterial color="#0d1522" roughness={0.7} metalness={0.3} />
        </mesh>

        {/* Illuminated Glass Entrance Double Doors */}
        <mesh position={[0, -h * 0.05, 0.21]}>
          <planeGeometry args={[w * 0.18, h * 0.32]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive={statusColor}
            emissiveIntensity={0.65}
            roughness={0.1}
          />
        </mesh>

        {/* Entrance Overhead Canopy */}
        <mesh position={[0, h * 0.22, 0.22]} castShadow>
          <boxGeometry args={[w * 0.38, 0.08, 0.6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

      {/* 9. SOLID CONCRETE ENTRANCE STEPS */}
      <group position={[0, 0.1, d / 2 + 0.55]}>
        <mesh receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[w * 0.34, 0.12, 0.28]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
        <mesh receiveShadow position={[0, -0.05, 0.22]}>
          <boxGeometry args={[w * 0.38, 0.1, 0.28]} />
          <meshStandardMaterial color="#162235" roughness={0.9} />
        </mesh>
        <mesh receiveShadow position={[0, -0.09, 0.44]}>
          <boxGeometry args={[w * 0.42, 0.08, 0.28]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
      </group>

      {/* 10. ARCHITECTURAL TYPE-SPECIFIC DETAILS */}
      {/* A. Classical Library: Solid Grand Pillars & Colonnade Portico */}
      {building.architecturalType === 'classical-library' && (
        <group position={[0, h * 0.3, d / 2 + 0.35]}>
          {[-w * 0.18, -w * 0.09, 0, w * 0.09, w * 0.18].map((colX, i) => (
            <mesh key={i} position={[colX, 0, 0.18]} castShadow>
              <cylinderGeometry args={[0.09, 0.11, h * 0.58, 12]} />
              <meshStandardMaterial color="#d97706" roughness={0.4} metalness={0.3} />
            </mesh>
          ))}
          {/* Triangular pediment roof over portico */}
          <mesh position={[0, h * 0.32, 0.18]} rotation={[0, 0, 0]}>
            <boxGeometry args={[w * 0.44, 0.18, 0.45]} />
            <meshStandardMaterial color="#b45309" roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* B. Science Wing: Extended Solid Research Wing */}
      {building.architecturalType === 'science-wing' && (
        <group position={[w * 0.32, (h * 0.8) / 2, d * 0.32]} castShadow receiveShadow>
          {/* Solid sub-wing */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[w * 0.45, h * 0.8, d * 0.45]} />
            <meshStandardMaterial color="#0f263d" roughness={0.65} metalness={0.25} />
          </mesh>
          {/* Sub-wing parapet */}
          <mesh position={[0, (h * 0.8) / 2 + 0.08, 0]}>
            <boxGeometry args={[w * 0.47, 0.16, d * 0.47]} />
            <meshStandardMaterial color="#0284c7" emissive="#00e5ff" emissiveIntensity={0.2} />
          </mesh>
        </group>
      )}

      {/* C. Stepped Annex: Multi-tiered Upper Block */}
      {building.architecturalType === 'stepped-annex' && (
        <group position={[0, h + 0.35, 0]} castShadow receiveShadow>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[w * 0.72, 0.65, d * 0.72]} />
            <meshStandardMaterial color="#1a2744" roughness={0.6} metalness={0.3} />
          </mesh>
          {/* Tier 2 window ribbon */}
          <mesh position={[0, 0, d * 0.36 + 0.02]}>
            <boxGeometry args={[w * 0.6, 0.22, 0.04]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )}

      {/* 11. GROUND FOOTPRINT BASE GLOW */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[w + 1.2, d + 1.2]} />
        <meshBasicMaterial
          color={statusColor}
          transparent
          opacity={isMatch ? 0.08 : 0.01}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
