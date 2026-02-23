
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { LayoutNode } from '../types';

interface BuildingProps {
  node: LayoutNode;
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  onHover: (path: string | null) => void;
  minDate: number;
  maxDate: number;
}

// Ease-out exponential lerp factor
const LERP_SPEED = 6;

// Cold color (old files)
const COLD = new THREE.Color('#3a6b9e');
// Hot color (recent files)
const HOT = new THREE.Color('#ff5500');
// Highlight color for files changed in current commit
const HIGHLIGHT = new THREE.Color('#ff8800');

export const Building: React.FC<BuildingProps> = ({
  node,
  changedPaths,
  onSelect,
  onHover,
  minDate,
  maxDate,
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const currentHRef = useRef(0); // animated height, starts at 0 (spawn animation)
  const hoveredRef = useRef(false);
  const [hovered, setHovered] = React.useState(false);

  // Linear scale height — clamped minimum so tiny files are still visible
  const targetH = Math.max(0.2, node.size * 0.1);

  // Sigmoid soft-minimum for footprint — prevents paper-thin buildings.
  // When the treemap cell is very narrow, sigmoid smoothly boosts it toward minFootprint.
  // When it's wide, the natural cell width is used unchanged.
  const MIN_FOOTPRINT = 1.0;
  const SIGMOID_K = 4;
  const softMin = (val: number) => {
    const t = 1 / (1 + Math.exp(-SIGMOID_K * (val - MIN_FOOTPRINT)));
    return MIN_FOOTPRINT * (1 - t) + val * t;
  };

  // Position (d3 treemap gives top-left; Three.js box is center-origin)
  const w = node.width;
  const d = node.height;
  const bw = softMin(w) * 0.88; // rendered building width (sigmoid-boosted)
  const bd = softMin(d) * 0.88; // rendered building depth
  const x = node.x + w / 2;
  const z = node.y + d / 2;

  // Recency color: 0 = oldest (cold), 1 = newest (hot)
  const dateMs = node.lastModified ? new Date(node.lastModified).getTime() : minDate;
  const range = maxDate - minDate || 1;
  const recency = Math.max(0, Math.min(1, (dateMs - minDate) / range));
  const baseColor = new THREE.Color().lerpColors(COLD, HOT, recency);

  const isChanged = changedPaths.has(node.path);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Exponential smoothing — ease-out lerp
    const factor = 1 - Math.exp(-delta * LERP_SPEED);
    currentHRef.current += (targetH - currentHRef.current) * factor;

    const h = Math.max(0.0001, currentHRef.current);

    // Scale y to animated height; keep base anchored at y = 0
    meshRef.current.scale.y = h / targetH;
    meshRef.current.position.y = h / 2;

    // Animate emissive: pulse changed buildings, fade others
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (isChanged) {
      const pulse = 0.4 + 0.3 * Math.sin(Date.now() * 0.005);
      mat.emissive.copy(HIGHLIGHT);
      mat.emissiveIntensity = pulse;
    } else {
      mat.emissiveIntensity *= 0.92; // fade out any leftover glow
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[x, 0, z]}
      onClick={(e) => { e.stopPropagation(); onSelect(node); }}
      onPointerOver={(e) => { e.stopPropagation(); hoveredRef.current = true; setHovered(true); onHover(node.path); }}
      onPointerOut={() => { hoveredRef.current = false; setHovered(false); onHover(null); }}
    >
      <boxGeometry args={[bw, targetH, bd]} />
      <meshStandardMaterial
        color={hovered ? '#ffffff' : baseColor}
        emissive={isChanged ? HIGHLIGHT : new THREE.Color(0, 0, 0)}
        emissiveIntensity={isChanged ? 0.6 : 0}
        roughness={0.6}
        metalness={0.2}
      />
      {hovered && (
        <Html
          position={[0, targetH / 2 + 0.5, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            {node.name}
          </div>
        </Html>
      )}
    </mesh>
  );
};
