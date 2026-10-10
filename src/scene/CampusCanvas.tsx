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
        shadows
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
        {/* Atmospheric Ambient and Key Directional Shadows */}
        <ambientLight intensity={0.65} color="#e2e8f0" />
        <directionalLight
          position={[35, 55, 30]}
          intensity={1.25}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          shadow-bias={-0.0005}
        />
        {/* Cool cybernetic fill light from opposite angle */}
        <directionalLight position={[-20, 30, -20]} intensity={0.4} color="#38bdf8" />
        <pointLight position={[-10, 15, -10]} intensity={1.8} color="#00e5ff" distance={45} />
        <pointLight position={[10, 15, 10]} intensity={1.4} color="#f97316" distance={45} />

        <CampusGround />
        <CampusBuildings />
        <EquipmentPins />
        <CameraController />

        <EffectComposer enableNormalPass={false} multisampling={4}>
          <Bloom
            luminanceThreshold={0.35}
            luminanceSmoothing={0.8}
            intensity={1.1}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
