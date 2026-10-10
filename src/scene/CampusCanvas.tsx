import React from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { CampusGround } from './CampusGround';
import { CampusBuildings } from './CampusBuildings';
import { EquipmentPins } from './EquipmentPins';
import { CameraController } from './CameraController';
import { useCampusStore } from '../store/campusStore';

export const CampusCanvas: React.FC = () => {
  const closeModal = useCampusStore((s) => s.closeModal);

  return (
    <div
      className="w-full h-full relative cursor-grab active:cursor-grabbing"
      onClick={() => {
        // Clicking outside closes the modal
        closeModal();
      }}
    >
      <Canvas
        orthographic
        camera={{
          position: [30, 26, 30],
          zoom: 26,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#050B14');
          camera.lookAt(0.8, 0, 0.5);
        }}
      >
        <ambientLight intensity={0.4} color="#cceeff" />
        <directionalLight position={[30, 50, 30]} intensity={0.8} color="#ffffff" />
        <pointLight position={[-10, 15, -10]} intensity={1.5} color="#00e5ff" distance={40} />
        <pointLight position={[10, 15, 10]} intensity={1.2} color="#f97316" distance={40} />

        <CampusGround />
        <CampusBuildings />
        <EquipmentPins />
        <CameraController />

        <EffectComposer enableNormalPass={false} multisampling={4}>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.85}
            intensity={1.2}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
