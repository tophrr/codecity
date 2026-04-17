import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { LayoutNode, CityConfig } from '../types';

interface InstancedBuildingsProps {
  nodes: LayoutNode[];
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  onHover: (path: string | null) => void;
  minDate: number;
  maxDate: number;
  config: CityConfig;
}

const MAGMA_COLORS = [
  new THREE.Color('#000004'),
  new THREE.Color('#3b0f70'),
  new THREE.Color('#8c2981'),
  new THREE.Color('#de4968'),
  new THREE.Color('#fe9f6d'),
  new THREE.Color('#fcfdbf')
];

const PLASMA_COLORS = [
  new THREE.Color('#0d0887'),
  new THREE.Color('#6a00a8'),
  new THREE.Color('#b12a90'),
  new THREE.Color('#e16462'),
  new THREE.Color('#fca636'),
  new THREE.Color('#f0f921')
];

const VIRIDIS_COLORS = [
  new THREE.Color('#440154'),
  new THREE.Color('#414487'),
  new THREE.Color('#2a788e'),
  new THREE.Color('#22a884'),
  new THREE.Color('#7ad151'),
  new THREE.Color('#fde725')
];

const INFERNO_COLORS = [
  new THREE.Color('#000004'),
  new THREE.Color('#420a68'),
  new THREE.Color('#932667'),
  new THREE.Color('#dd513a'),
  new THREE.Color('#fca50a'),
  new THREE.Color('#fcffa4')
];

function getPalette(palette: string) {
  switch (palette) {
    case 'plasma': return PLASMA_COLORS;
    case 'viridis': return VIRIDIS_COLORS;
    case 'inferno': return INFERNO_COLORS;
    case 'magma':
    default:
      return MAGMA_COLORS;
  }
}

function getColor(t: number, target: THREE.Color, palette: string) {
  const colors = getPalette(palette);
  const scaledT = Math.max(0, Math.min(1, t)) * (colors.length - 1);
  const index = Math.floor(scaledT);
  const fraction = scaledT - index;
  
  if (index >= colors.length - 1) {
    target.copy(colors[colors.length - 1]);
    return;
  }
  
  target.copy(colors[index]).lerp(colors[index + 1], fraction);
}

const HIGHLIGHT = new THREE.Color('#ffffff'); // Stand out from magma

export const InstancedBuildings: React.FC<InstancedBuildingsProps> = ({
  nodes,
  changedPaths,
  onSelect,
  onHover,
  minDate,
  maxDate,
  config,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const tempMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();
  
  // Track hovered instance for rendering tooltip and white color
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hoveredIdxRef = useRef<number | null>(null);

  // Use refs for animation states
  const currentHeights = useRef<Float32Array>(new Float32Array(nodes.length));
  const previousHeightsMap = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    // Attempt to retain previous height where possible
    const nextHeights = new Float32Array(nodes.length);
    nodes.forEach((n, i) => {
      const prev = previousHeightsMap.current.get(n.path);
      if (prev !== undefined) {
        nextHeights[i] = prev;
      }
    });
    currentHeights.current = nextHeights;
  }, [nodes]);

  const MIN_FOOTPRINT = 1.0;
  const SIGMOID_K = 4;
  const softMin = (val: number) => {
    const t = 1 / (1 + Math.exp(-SIGMOID_K * (val - MIN_FOOTPRINT)));
    return MIN_FOOTPRINT * (1 - t) + val * t;
  };

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const LERP_SPEED = 6;
    const factor = 1 - Math.exp(-delta * LERP_SPEED);

    nodes.forEach((node, i) => {
      const targetH = Math.max(0.2, (node.size * 0.1) * config.verticalScale);
      const prevH = currentHeights.current[i];
      const h = prevH + (targetH - prevH) * factor;
      currentHeights.current[i] = Math.max(0.0001, h);
      previousHeightsMap.current.set(node.path, h);

      const w = node.width;
      const d = node.height;
      const bw = softMin(w) * 0.88; 
      const bd = softMin(d) * 0.88; 
      const x = node.x + w / 2;
      const z = node.y + d / 2;

      tempMatrix.makeScale(bw, h, bd);
      tempMatrix.setPosition(x, h / 2, z);
      meshRef.current.setMatrixAt(i, tempMatrix);
      
      const isChanged = changedPaths.has(node.path);
      const isHovered = hoveredIdxRef.current === i;

      if (isHovered) {
        tempColor.set('#00ffff'); // Cyan highlight for hover stands out against magma
      } else if (isChanged) {
        // Simple pulsing or highlighting logic could be applied here via instance colors
        const pulse = 0.4 + 0.3 * Math.sin(Date.now() * 0.005);
        tempColor.copy(HIGHLIGHT).lerp(HIGHLIGHT, pulse); // Placeholder for highlight
      } else {
        const dateMs = node.lastModified ? new Date(node.lastModified).getTime() : minDate;
        const range = maxDate - minDate || 1;
        const recency = Math.max(0, Math.min(1, (dateMs - minDate) / range));
        getColor(recency, tempColor, config.colorPalette);
      }
      meshRef.current.setColorAt(i, tempColor);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    
    // R3F / Three.js needs an updated bounding sphere for raycasting to work properly
    // Overriding it with a giant sphere avoids expensive per-frame recalculations 
    // and guarantees raycasting never arbitrarily skips this mesh.
    if (!meshRef.current.boundingSphere) {
      meshRef.current.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 100000);
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      onSelect(nodes[e.instanceId]);
    }
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      hoveredIdxRef.current = e.instanceId;
      setHoveredIdx(e.instanceId);
      onHover(nodes[e.instanceId].path);
    }
  };

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && hoveredIdxRef.current !== e.instanceId) {
      hoveredIdxRef.current = e.instanceId;
      setHoveredIdx(e.instanceId);
      onHover(nodes[e.instanceId].path);
    }
  };

  const handlePointerOut = () => {
    hoveredIdxRef.current = null;
    setHoveredIdx(null);
    onHover(null);
  };

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
      
      {hoveredIdx !== null && nodes[hoveredIdx] && (
        <Html
          position={[
            nodes[hoveredIdx].x + nodes[hoveredIdx].width / 2, 
            Math.max(0.2, (nodes[hoveredIdx].size * 0.1) * config.verticalScale) / 2 + 0.5, 
            nodes[hoveredIdx].y + nodes[hoveredIdx].height / 2
          ]}
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
            {nodes[hoveredIdx].name}
          </div>
        </Html>
      )}
    </group>
  );
};
