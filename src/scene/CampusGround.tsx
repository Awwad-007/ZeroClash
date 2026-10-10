import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useCampusStore } from '../store/campusStore';

export const CampusGround: React.FC = () => {
  const showGrid = useCampusStore((s) => s.showGrid);

  // Pathways connecting courtyard plaza to each building entrance
  const pathGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    // Central courtyard diamond loop
    const courtyardCorners = [
      new THREE.Vector3(-1.2, 0.02, -2.5),
      new THREE.Vector3(3.5, 0.02, 0.5),
      new THREE.Vector3(0.5, 0.02, 3.8),
      new THREE.Vector3(-3.5, 0.02, 0.8),
      new THREE.Vector3(-1.2, 0.02, -2.5), // close loop
    ];

    for (let i = 0; i < courtyardCorners.length - 1; i++) {
      points.push(courtyardCorners[i], courtyardCorners[i + 1]);
    }

    // Courtyard inner diagonal cross lines
    points.push(new THREE.Vector3(-3.5, 0.02, 0.8), new THREE.Vector3(3.5, 0.02, 0.5));
    points.push(new THREE.Vector3(-1.2, 0.02, -2.5), new THREE.Vector3(0.5, 0.02, 3.8));

    // Connectors from central courtyard to building entrances:
    // 1. To Science Wing (-7.5, 0, -1.5)
    points.push(new THREE.Vector3(-3.5, 0.02, 0.8), new THREE.Vector3(-5.2, 0.02, 0.5));

    // 2. To Media Lab NE (4.5, 0, -4.5)
    points.push(new THREE.Vector3(1.0, 0.02, -1.8), new THREE.Vector3(3.2, 0.02, -2.8));

    // 3. To Main Library Locker (6.5, 0, 6.0)
    points.push(new THREE.Vector3(2.5, 0.02, 2.0), new THREE.Vector3(4.5, 0.02, 3.8));

    // 4. To Media Lab South (0.5, 0, 8.0)
    points.push(new THREE.Vector3(0.5, 0.02, 3.8), new THREE.Vector3(0.5, 0.02, 5.5));

    // 5. To Media Lab SW (-6.0, 0, 4.5)
    points.push(new THREE.Vector3(-2.2, 0.02, 2.2), new THREE.Vector3(-4.0, 0.02, 3.5));

    // Outer courtyard perimeter ring
    const outerRing = [
      new THREE.Vector3(-14, 0.01, -14),
      new THREE.Vector3(16, 0.01, -14),
      new THREE.Vector3(16, 0.01, 14),
      new THREE.Vector3(-14, 0.01, 14),
      new THREE.Vector3(-14, 0.01, -14),
    ];
    for (let i = 0; i < outerRing.length - 1; i++) {
      points.push(outerRing[i], outerRing[i + 1]);
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, []);

  // Floor isometric grid
  const gridLinesGeometry = useMemo(() => {
    const size = 38;
    const divisions = 38;
    const step = size / divisions;
    const half = size / 2;
    const pts: THREE.Vector3[] = [];

    for (let i = 0; i <= divisions; i++) {
      const coord = -half + i * step;
      // Grid along X
      pts.push(new THREE.Vector3(-half, 0.005, coord), new THREE.Vector3(half, 0.005, coord));
      // Grid along Z
      pts.push(new THREE.Vector3(coord, 0.005, -half), new THREE.Vector3(coord, 0.005, half));
    }

    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  return (
    <group>
      {/* Dark background base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color="#050B14" depthWrite={false} />
      </mesh>

      {/* Isometric floor grid */}
      {showGrid && (
        <lineSegments geometry={gridLinesGeometry}>
          <lineBasicMaterial
            color="#00e5ff"
            transparent
            opacity={0.07}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>
      )}

      {/* Glowing courtyard & building pathways */}
      <lineSegments geometry={pathGeometry}>
        <lineBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.65}
          linewidth={2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Central courtyard translucent decorative polygon */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.5]}>
        <ringGeometry args={[0, 3.8, 4]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.04}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
