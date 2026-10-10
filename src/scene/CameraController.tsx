import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useCampusStore } from '../store/campusStore';

export const CameraController: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const cameraTarget = useCampusStore((s) => s.cameraTarget);
  const cameraZoom = useCampusStore((s) => s.cameraZoom);
  const setCameraZoom = useCampusStore((s) => s.setCameraZoom);

  const targetVec = useRef(new THREE.Vector3(...cameraTarget));

  useEffect(() => {
    targetVec.current.set(...cameraTarget);
  }, [cameraTarget]);

  // Sync zoom state with camera
  useEffect(() => {
    if ('zoom' in camera) {
      camera.zoom = cameraZoom;
      camera.updateProjectionMatrix();
    }
  }, [cameraZoom, camera]);

  useFrame((_, delta) => {
    if (controlsRef.current) {
      // Smoothly lerp OrbitControls target to current desired target
      controlsRef.current.target.lerp(targetVec.current, Math.min(delta * 4, 1));
      controlsRef.current.update();

      // Keep store zoom updated if user scrolls with mouse wheel
      if ('zoom' in camera && Math.abs(camera.zoom - cameraZoom) > 0.5) {
        setCameraZoom(camera.zoom);
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0.8, 0, 0.5]}
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      minZoom={10}
      maxZoom={80}
    />
  );
};
