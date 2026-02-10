
import React from 'react';
import type { LayoutNode } from '../types';
import { Building } from './Building';

interface DistrictProps {
  node: LayoutNode;
  depth?: number;
}

export const District: React.FC<DistrictProps> = ({ node, depth = 0 }) => {
  // District base (footprint)
  const w = node.width;
  const d = node.height; // z
  const x = node.x + w / 2;
  const z = node.y + d / 2;
  
  // District height (thin slice)
  const h = 0.5;
  const y = -h/2 - (depth * 0.1); // Stack districts downwards slightly to avoid z-fighting?
                                  // Or just at y=0.
                                  // Better: slight offset based on depth to show hierarchy visually if needed.
                                  // For now, let's put them just below y=0.

  return (
    <group>
      {/* Background/Base for the district */}
      <mesh position={[x, y, z]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial 
          color={'#cccccc'} 
          transparent 
          opacity={0.1 + (depth * 0.05)} 
          wireframe={false} 
        />
        {/* Wireframe border for distinct look */}
        {/* Or line segments. For MVP, simple box. */}
      </mesh>
      
      {/* Render children */}
      {node.children?.map((child) => (
        child.type === 'file' ? (
          <Building key={child.path} node={child} />
        ) : (
          <District key={child.path} node={child} depth={depth + 1} />
        )
      ))}
    </group>
  );
};
