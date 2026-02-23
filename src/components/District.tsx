
import React from 'react';
import type { LayoutNode } from '../types';
import { Building } from './Building';

interface DistrictProps {
  node: LayoutNode;
  depth?: number;
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  minDate: number;
  maxDate: number;
}

export const District: React.FC<DistrictProps> = ({ node, depth = 0, changedPaths, onSelect, minDate, maxDate }) => {
  const w = node.width;
  const d = node.height;
  const x = node.x + w / 2;
  const z = node.y + d / 2;
  const h = 0.3;
  const y = -h / 2 - depth * 0.1;

  const sharedProps = { changedPaths, onSelect, minDate, maxDate };

  return (
    <group>
      <mesh position={[x, y, z]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={'#1a1a2e'}
          transparent
          opacity={0.5 + depth * 0.1}
          roughness={1}
        />
      </mesh>

      {node.children?.map((child) => (
        child.type === 'file' ? (
          <Building key={child.path} node={child} {...sharedProps} />
        ) : (
          <District key={child.path} node={child} depth={depth + 1} {...sharedProps} />
        )
      ))}
    </group>
  );
};
