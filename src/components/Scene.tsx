
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { City } from './City';
import type { LayoutNode } from '../types';

interface SceneProps {
  data: LayoutNode;
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  minDate: number;
  maxDate: number;
}

export const Scene: React.FC<SceneProps> = ({ data, changedPaths, onSelect, minDate, maxDate }) => {
  const cx = data.width / 2;
  const cz = data.height / 2;
  const size = Math.max(data.width, data.height);

  return (
    <Canvas
      style={{ width: '100vw', height: '100vh', background: '#0a0a12' }}
      gl={{ antialias: true, toneMappingExposure: 1.2 }}
    >
      <fog attach="fog" args={['#0a0a12', size * 0.6, size * 2.2]} />

      <PerspectiveCamera makeDefault position={[cx, size * 0.8, cz * 2]} fov={60} />
      <OrbitControls target={[cx, 0, cz]} />

      <ambientLight intensity={0.3} />
      <directionalLight position={[size, size, size * 0.5]} intensity={1.2} castShadow />
      <pointLight position={[cx, size * 0.4, cz]} intensity={0.8} color="#6688ff" />
      <hemisphereLight args={['#202040', '#000000', 0.4]} />

      {/* Single global road ground plane — district gaps expose this as streets */}
      <mesh position={[cx, -0.02, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size * 1.5, size * 1.5]} />
        <meshStandardMaterial color="#52527a" roughness={0.95} metalness={0.05} />
      </mesh>

      <City
        root={data}
        changedPaths={changedPaths}
        onSelect={onSelect}
        minDate={minDate}
        maxDate={maxDate}
      />

      <gridHelper args={[size * 2, 40, '#1a1a30', '#111120']} position={[cx, -0.6, cz]} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.6}
          luminanceSmoothing={0.3}
          intensity={0.8}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
};
