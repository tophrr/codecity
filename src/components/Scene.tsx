
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { City } from './City';
import type { LayoutNode } from '../types';

interface SceneProps {
  data: LayoutNode;
}

export const Scene: React.FC<SceneProps> = ({ data }) => {
  // Determine camera position based on city size
  // Center is roughly width/2, height/2 (in layout coords)
  const cx = data.width / 2;
  const cz = data.height / 2;
  const size = Math.max(data.width, data.height);
  
  return (
    <Canvas style={{ width: '100vw', height: '100vh', background: '#111' }}>
      <PerspectiveCamera makeDefault position={[cx, size, cz * 2]} fov={60} />
      <OrbitControls target={[cx, 0, cz]} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <pointLight position={[cx, 20, cz]} intensity={0.5} />
      
      <City root={data} />
      
      <gridHelper args={[size * 2, 20]} position={[cx, -0.1, cz]} />
    </Canvas>
  );
};
