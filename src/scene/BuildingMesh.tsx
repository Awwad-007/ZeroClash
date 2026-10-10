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
  const wireframeOnly = useCampusStore((s) => s.wireframeOnly);
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
    if (hasAvailable) return building.neonColor; // Theme neon
    return building.neonColor;
  }, [building, equipment, isPulsing]);

  // Procedural architecture elements
  const { mainBoxGeo, edgesGeo, facadeLinesGeo, stepsGeo, extraBoxes } = useMemo(() => {
    const [w, h, d] = building.size;
    const mainBox = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(mainBox);

    const facadeLines: THREE.Vector3[] = [];
    const extras: { pos: [number, number, number]; size: [number, number, number] }[] = [];

    // Add floor divisions and window mullions
    const floors = 3;
    for (let f = 1; f < floors; f++) {
      const y = (h / floors) * f - h / 2;
      // Front and back horizontal floor lines
      facadeLines.push(
        new THREE.Vector3(-w / 2, y, d / 2),
        new THREE.Vector3(w / 2, y, d / 2),
        new THREE.Vector3(-w / 2, y, -d / 2),
        new THREE.Vector3(w / 2, y, -d / 2),
        new THREE.Vector3(-w / 2, y, -d / 2),
        new THREE.Vector3(-w / 2, y, d / 2),
        new THREE.Vector3(w / 2, y, -d / 2),
        new THREE.Vector3(w / 2, y, d / 2)
      );
    }

    // Vertical facade mullion stripes
    const cols = 5;
    for (let c = 1; c < cols; c++) {
      const x = (w / cols) * c - w / 2;
      facadeLines.push(
        new THREE.Vector3(x, -h / 2, d / 2),
        new THREE.Vector3(x, h / 2, d / 2),
        new THREE.Vector3(x, -h / 2, -d / 2),
        new THREE.Vector3(x, h / 2, -d / 2)
      );
    }

    // Custom architectural details depending on type:
    if (building.architecturalType === 'science-wing') {
      // L-shaped extended wing extending along +Z
      extras.push({
        pos: [w * 0.28, -h * 0.05, d * 0.35],
        size: [w * 0.44, h * 0.9, d * 0.45],
      });
      // Entrance portico & canopy facing courtyard
      extras.push({
        pos: [w * 0.1, -h * 0.25, d * 0.52],
        size: [w * 0.28, h * 0.45, d * 0.18],
      });
      // Roof mechanical penthouse
      extras.push({
        pos: [-w * 0.15, h * 0.54, -d * 0.1],
        size: [w * 0.5, h * 0.18, d * 0.5],
      });
    } else if (building.architecturalType === 'classical-library') {
      // Library entrance portico facing courtyard (-X, -Z)
      extras.push({
        pos: [-w * 0.3, -h * 0.25, -d * 0.3],
        size: [w * 0.4, h * 0.45, d * 0.2],
      });
      // Stepped cornice on roof
      extras.push({
        pos: [0, h * 0.52, 0],
        size: [w * 0.88, h * 0.1, d * 0.88],
      });
      // Classical columns along front facade
      const colCount = 6;
      for (let c = 0; c < colCount; c++) {
        const colX = -w * 0.45 + (w * 0.4 / (colCount - 1)) * c;
        extras.push({
          pos: [colX, -h * 0.15, -d * 0.52],
          size: [0.25, h * 0.65, 0.25],
        });
      }
    } else if (building.architecturalType === 'media-hall') {
      // Front entrance portico facing courtyard
      extras.push({
        pos: [0, -h * 0.28, d * 0.52],
        size: [w * 0.32, h * 0.4, d * 0.18],
      });
      // Roof parapet frame
      extras.push({
        pos: [0, h * 0.51, 0],
        size: [w * 0.9, h * 0.08, d * 0.9],
      });
    } else if (building.architecturalType === 'stepped-annex') {
      // Stepped tiered upper blocks
      extras.push({
        pos: [0, h * 0.54, 0],
        size: [w * 0.75, h * 0.25, d * 0.75],
      });
    } else if (building.architecturalType === 'cube-archive') {
      // Stepped back block
      extras.push({
        pos: [0, h * 0.52, 0],
        size: [w * 0.65, h * 0.22, d * 0.65],
      });
    }

    // Entrance steps geometry
    const steps: THREE.Vector3[] = [];
    const stepCount = 4;
    for (let s = 0; s < stepCount; s++) {
      const stepY = -h / 2 + (s * 0.1);
      const stepZ = d / 2 + (s * 0.2);
      steps.push(
        new THREE.Vector3(-1.2, stepY, stepZ),
        new THREE.Vector3(1.2, stepY, stepZ)
      );
    }

    const facadeGeo = new THREE.BufferGeometry().setFromPoints(facadeLines);
    const stepsBufferGeo = new THREE.BufferGeometry().setFromPoints(steps);

    return {
      mainBoxGeo: mainBox,
      edgesGeo: edges,
      facadeLinesGeo: facadeGeo,
      stepsGeo: stepsBufferGeo,
      extraBoxes: extras,
    };
  }, [building]);

  // Opacity & Dimming logic based on search
  const fillOpacity = useMemo(() => {
    if (!isMatch) return 0.03;
    if (wireframeOnly) return 0.0;
    if (hovered || isSelected) return 0.35;
    return 0.16;
  }, [isMatch, wireframeOnly, hovered, isSelected]);

  const lineOpacity = useMemo(() => {
    if (!isMatch) return 0.15;
    if (hovered || isSelected) return 1.0;
    return 0.85;
  }, [isMatch, hovered, isSelected]);

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
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Main translucent volume */}
      <mesh geometry={mainBoxGeo} position={[0, building.size[1] / 2, 0]}>
        <meshBasicMaterial
          color={building.fillColor}
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Main neon wireframe edges */}
      <lineSegments geometry={edgesGeo} position={[0, building.size[1] / 2, 0]}>
        <lineBasicMaterial
          color={statusColor}
          transparent
          opacity={lineOpacity}
          linewidth={2}
        />
      </lineSegments>

      {/* Facade grid / window mullions */}
      <lineSegments geometry={facadeLinesGeo} position={[0, building.size[1] / 2, 0]}>
        <lineBasicMaterial
          color={statusColor}
          transparent
          opacity={lineOpacity * 0.4}
          depthWrite={false}
        />
      </lineSegments>

      {/* Entrance steps */}
      <lineSegments geometry={stepsGeo} position={[0, building.size[1] / 2, 0]}>
        <lineBasicMaterial
          color={statusColor}
          transparent
          opacity={lineOpacity * 0.6}
        />
      </lineSegments>

      {/* Architectural sub-boxes (wings, porticos, penthouses) */}
      {extraBoxes.map((extra, idx) => (
        <group key={idx} position={[extra.pos[0], extra.pos[1] + building.size[1] / 2, extra.pos[2]]}>
          <mesh>
            <boxGeometry args={extra.size} />
            <meshBasicMaterial
              color={building.fillColor}
              transparent
              opacity={fillOpacity * 0.9}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...extra.size)]} />
            <lineBasicMaterial
              color={statusColor}
              transparent
              opacity={lineOpacity * 0.8}
            />
          </lineSegments>
        </group>
      ))}

      {/* Ground footprint glow outline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[building.size[0] + 0.6, building.size[2] + 0.6]} />
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
