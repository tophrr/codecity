import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LayoutNode } from '../types';

interface InstancedBuildingsProps {
  nodes: LayoutNode[];
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  onHover: (path: string | null) => void;
  minDate: number;
  maxDate: number;
}

const COLD = new THREE.Color('#3a6b9e');
const HOT = new THREE.Color('#ff5500');
const HIGHLIGHT = new THREE.Color('#ff8800');

export const InstancedBuildings: React.FC<InstancedBuildingsProps> = ({
  nodes,
  changedPaths,
  onSelect,
  onHover,
  minDate,
  maxDate,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const tempMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();

  // Use refs for animation states
  const currentHeights = useRef<Float32Array>(new Float32Array(nodes.length));
  
  useEffect(() => {
    // reset current heights when nodes change completely
    currentHeights.current = new Float32Array(nodes.length);
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
      const targetH = Math.max(0.2, node.size * 0.1);
      const prevH = currentHeights.current[i];
      const h = prevH + (targetH - prevH) * factor;
      currentHeights.current[i] = Math.max(0.0001, h);

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
      if (isChanged) {
        // Simple pulsing or highlighting logic could be applied here via instance colors
        // For accurate emissive pulsing per-instance, custom shaders are ideal, 
        // but for now we manipulate base color
        const pulse = 0.4 + 0.3 * Math.sin(Date.now() * 0.005);
        tempColor.copy(HIGHLIGHT).lerp(HIGHLIGHT, pulse); // Placeholder for highlight
      } else {
        const dateMs = node.lastModified ? new Date(node.lastModified).getTime() : minDate;
        const range = maxDate - minDate || 1;
        const recency = Math.max(0, Math.min(1, (dateMs - minDate) / range));
        tempColor.copy(COLD).lerp(HOT, recency);
      }
      meshRef.current.setColorAt(i, tempColor);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
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
      onHover(nodes[e.instanceId].path);
    }
  };

  const handlePointerOut = () => {
    onHover(null);
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
};
