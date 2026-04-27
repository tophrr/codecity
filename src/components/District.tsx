
import React from 'react';
import { Text } from '@react-three/drei';
import type { LayoutNode, CityConfig } from '../types';

interface DistrictProps {
  node: LayoutNode;
  depth?: number;
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  onHover: (path: string | null) => void;
  minDate: number;
  maxDate: number;
  config: CityConfig;
}

const LOT_DEPTH_COLORS = [
  '#0f172a',
  '#12324a',
  '#195568',
  '#2a776b',
  '#4a8f5e',
  '#7a9b52',
  '#b28d4b',
  '#c1734a',
  '#a3573f',
];

const getLotColorForDepth = (depth: number): string => {
  const clampedDepth = Math.min(depth, LOT_DEPTH_COLORS.length - 1);
  return LOT_DEPTH_COLORS[clampedDepth];
};

export const District: React.FC<DistrictProps> = ({ node, depth = 0, changedPaths, onSelect, onHover, minDate, maxDate, config }) => {
  const w = node.width;
  const d = node.height;
  const x = node.x + w / 2;
  const z = node.y + d / 2;

  const lotH = config.district.lotHeight;
  // Make depth layering obvious by lifting each lot by its own half-height plus depth step.
  const lotY = 0.01 + lotH / 2 + depth * config.district.lotDepthStep;

  const sharedProps = { changedPaths, onSelect, onHover, minDate, maxDate, config };

  // Only render labels for reasonably sized districts to avoid clutter
  const showLabel = depth > 0 && depth < 4 && w > 4 && d > 4;

  return (
    <group>
      {/* Lot surface — exact footprint only, raised above the global road plane */}
      <mesh position={[x, lotY, z]} receiveShadow>
        <boxGeometry args={[w, lotH, d]} />
        <meshStandardMaterial
          color={getLotColorForDepth(depth)}
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
