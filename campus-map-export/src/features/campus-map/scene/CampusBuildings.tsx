import React from 'react';
import { useCampusStore } from '../store/campusStore';
import { BuildingMesh } from './BuildingMesh';

export const CampusBuildings: React.FC = () => {
  const buildings = useCampusStore((s) => s.buildings);

  return (
    <group>
      {buildings.map((building) => (
        <BuildingMesh key={building.id} building={building} />
      ))}
    </group>
  );
};
