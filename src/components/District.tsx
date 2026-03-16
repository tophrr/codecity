
import React from 'react';
import { Text } from '@react-three/drei';
import type { LayoutNode } from '../types';

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

  // Only render labels for reasonably sized districts to avoid clutter
  const showLabel = depth > 0 && depth < 4 && w > 4 && d > 4;

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

      {/* District Label placed on the top-left edge of the district lot */}
      {showLabel && (
        <Text
          position={[node.x + 0.5, lotY + lotH / 2 + 0.01, node.y + 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={Math.min(1.5, Math.max(0.4, w * 0.05))}
          color="#8888aa"
          anchorX="left"
          anchorY="top"
          fillOpacity={0.6}
        >
          {node.name}
        </Text>
      )}

      {node.children?.map((child) => (
        child.type === 'directory' && (
          <District key={child.path} node={child} depth={depth + 1} {...sharedProps} />
        )
      ))}
    </group>
  );
};
