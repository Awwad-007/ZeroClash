import React from 'react';
import { MOCK_BUILDINGS } from '../data/mock';
import { BuildingMesh } from './BuildingMesh';

export const CampusBuildings: React.FC = () => {
  return (
    <group>
      {MOCK_BUILDINGS.map((building) => (
        <BuildingMesh key={building.id} building={building} />
      ))}
    </group>
  );
};
