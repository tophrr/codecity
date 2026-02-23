
import React from 'react';
import type { LayoutNode } from '../types';
import { Building } from './Building';

interface DistrictProps {
  node: LayoutNode;
  depth?: number;
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  onHover: (path: string | null) => void;
  minDate: number;
  maxDate: number;
}

// Lot surface color per depth — sits above the global road plane
const LOT_COLOR = ['#1a1a30', '#161628', '#121220'];

export const District: React.FC<DistrictProps> = ({ node, depth = 0, changedPaths, onSelect, onHover, minDate, maxDate }) => {
  const w = node.width;
  const d = node.height;
  const x = node.x + w / 2;
  const z = node.y + d / 2;

  // Each depth level raises the lot slightly above the global ground plane.
  // This means gaps in the treemap expose the lot of the parent (or the road ground at depth 0).
  // No padding — no overlap possible.
  const lotY = 0.01 + depth * 0.015;
  const lotH = 0.04;

  const sharedProps = { changedPaths, onSelect, onHover, minDate, maxDate };

  return (
    <group>
      {/* Lot surface — exact footprint only, raised above the global road plane */}
      <mesh position={[x, lotY, z]} receiveShadow>
        <boxGeometry args={[w, lotH, d]} />
        <meshStandardMaterial
          color={LOT_COLOR[Math.min(depth, 2)]}
          roughness={0.9}
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
