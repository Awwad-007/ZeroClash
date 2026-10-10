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

    return new THREE.BufferGeometry().setFromPoints(points);
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
      pts.push(new THREE.Vector3(-half, 0.005, coord), new THREE.Vector3(half, 0.005, coord));
      pts.push(new THREE.Vector3(coord, 0.005, -half), new THREE.Vector3(coord, 0.005, half));
    }

    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  // Tree locations around the campus courtyard and plazas
  const treePositions: [number, number, number][] = useMemo(
    () => [
      [-1.8, 0, -0.6],
      [1.8, 0, 1.8],
      [-4.0, 0, -3.8],
      [7.2, 0, 0.8],
      [-2.2, 0, 5.2],
      [3.0, 0, -1.8],
      [-1.2, 0, -4.5],
      [5.2, 0, 2.5],
      [-5.0, 0, 2.2],
    ],
    []
  );

  // Pathway bollard lamp positions
  const lampPositions: [number, number, number][] = useMemo(
    () => [
      [-3.2, 0, 0.7],
      [-1.1, 0, -2.2],
      [3.2, 0, 0.4],
      [0.4, 0, 3.5],
      [1.8, 0, -1.6],
      [-2.0, 0, 2.0],
      [2.2, 0, 1.8],
      [-4.8, 0, 0.6],
      [4.2, 0, 3.5],
    ],
    []
  );

  // Bench positions around courtyard
  const benchPositions: [number, number, number][] = useMemo(
    () => [
      [-0.8, 0, -1.5],
      [2.2, 0, 0.8],
      [-1.8, 0, 1.2],
      [0.8, 0, 2.5],
    ],
    []
  );

  return (
    <group>
      {/* 1. Dark background base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color="#050B14" depthWrite={false} />
      </mesh>

      {/* 2. Central Courtyard Solid Paved Plaza Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.5]} receiveShadow>
        <planeGeometry args={[11, 11]} />
        <meshStandardMaterial color="#0b121e" roughness={0.9} />
      </mesh>

      {/* 3. Central Plaza Inner Decorative Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.5]}>
        <ringGeometry args={[2.5, 3.6, 6]} />
        <meshStandardMaterial color="#0e1a2b" roughness={0.8} />
      </mesh>

      {/* 4. Isometric floor grid */}
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

      {/* 5. Glowing courtyard & building pathways */}
      <lineSegments geometry={pathGeometry}>
        <lineBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.55}
          linewidth={2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* 6. Stylized Low-Poly Campus Trees */}
      {treePositions.map((pos, idx) => (
        <group key={idx} position={pos}>
          {/* Tree Trunk */}
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 0.7, 6]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          {/* Lower Foliage Block */}
          <mesh position={[0, 0.85, 0]} castShadow>
            <dodecahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial color="#064e3b" roughness={0.7} metalness={0.1} />
          </mesh>
          {/* Upper Foliage Tip with subtle emissive cyber-green */}
          <mesh position={[0, 1.25, 0]} castShadow>
            <dodecahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial
              color="#059669"
              emissive="#10b981"
              emissiveIntensity={0.25}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}

      {/* 7. Illuminated Pathway Lamp Bollards */}
      {lampPositions.map((pos, idx) => (
        <group key={idx} position={pos}>
          {/* Bollard Pole */}
          <mesh position={[0, 0.28, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 0.56, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Glowing Lamp Head */}
          <mesh position={[0, 0.58, 0]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
        </group>
      ))}

      {/* 8. Courtyard Stone Benches */}
      {benchPositions.map((pos, idx) => (
        <group key={idx} position={pos}>
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.18, 0.3]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
