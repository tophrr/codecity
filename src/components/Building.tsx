
import React, { useRef, useState } from 'react';
import type { LayoutNode } from '../types';

interface BuildingProps {
  node: LayoutNode;
}

export const Building: React.FC<BuildingProps> = ({ node }) => {
  const meshRef = useRef<any>(null);
  const [hovered, setHover] = useState(false);
  
  // Dimensions
  const w = node.width;
  const d = node.height; // layout 'height' is depth in 3D (z)
  
  // Height metric: Scaled LoC
  // Prevent huge spikes. Maybe log scale?
  // Let's iterate. simple linear scale for now.
  const h = Math.max(0.1, node.size * 0.1); 
  
  // Position
  // d3 coords are top-left (x0, y0).
  // Three.js BoxGeometry is centered.
  // We need to shift by half width/depth.
  // Also layout is 2D (x, y). In 3D: x -> x, y -> z
  const x = node.x + w / 2;
  const z = node.y + d / 2;
  const y = h / 2; // Sitting on ground (y=0)

  // Color by file type (extension)
  const getFileColor = (name: string) => {
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return '#3178c6';
    if (name.endsWith('.js')) return '#f7df1e';
    if (name.endsWith('.css')) return '#264de4';
    if (name.endsWith('.json')) return '#292929';
    if (name.endsWith('.md')) return '#000000';
    return '#888888';
  };

  const color = getFileColor(node.name);

  return (
    <mesh
      ref={meshRef}
      position={[x, y, z]}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[w * 0.9, h, d * 0.9]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : color} />
    </mesh>
  );
};
