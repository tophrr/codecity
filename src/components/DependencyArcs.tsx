import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

export type PositionMap = Map<string, [number, number, number]>; // path → [x, y_top, z]

interface DependencyArcsProps {
  hoveredPath: string | null;
  deps: Record<string, string[]>;
  positionMap: PositionMap;
}

const ARC_SEGMENTS = 40;
const ARC_COLOR_OUT = '#4af0ff';  // outgoing imports — cyan
const ARC_COLOR_IN  = '#ff6a00';  // incoming (imported by) — orange

function quadraticBezierPoints(
  p0: THREE.Vector3,
  p1: THREE.Vector3,  // control
  p2: THREE.Vector3,
  segments: number,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
    const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
    const z = (1 - t) ** 2 * p0.z + 2 * (1 - t) * t * p1.z + t ** 2 * p2.z;
    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}

function buildArcPoints(
  from: [number, number, number],
  to: [number, number, number],
): THREE.Vector3[] {
  const [x1, y1, z1] = from;
  const [x2, y2, z2] = to;
  const start = new THREE.Vector3(x1, y1, z1);
  const end   = new THREE.Vector3(x2, y2, z2);

  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Arc peak: midpoint between the two tops, elevated above the taller one
  const peakY = Math.max(y1, y2) + dist * 0.45 + 2;
  const ctrl = new THREE.Vector3((x1 + x2) / 2, peakY, (z1 + z2) / 2);

  return quadraticBezierPoints(start, ctrl, end, ARC_SEGMENTS);
}

export const DependencyArcs: React.FC<DependencyArcsProps> = ({
  hoveredPath,
  deps,
  positionMap,
}) => {
  const arcs = useMemo(() => {
    if (!hoveredPath) return null;

    const fromPos = positionMap.get(hoveredPath);
    if (!fromPos) return null;

    const outgoing: THREE.Vector3[][] = [];
    const incoming: THREE.Vector3[][] = [];

    // Outgoing: what this file imports
    const targets = deps[hoveredPath] ?? [];
    for (const target of targets) {
      const toPos = positionMap.get(target);
      if (toPos) outgoing.push(buildArcPoints(fromPos, toPos));
    }

    // Incoming: what imports this file (reverse lookup)
    for (const [importer, importees] of Object.entries(deps)) {
      if (importees.includes(hoveredPath)) {
        const fromImporterPos = positionMap.get(importer);
        if (fromImporterPos) incoming.push(buildArcPoints(fromImporterPos, fromPos));
      }
    }

    return { outgoing, incoming };
  }, [hoveredPath, deps, positionMap]);

  if (!arcs) return null;

  return (
    <group>
      {arcs.outgoing.map((pts, i) => (
        <Line
          key={`out-${i}`}
          points={pts}
          color={ARC_COLOR_OUT}
          lineWidth={1.5}
          transparent
          opacity={0.85}
        />
      ))}
      {arcs.incoming.map((pts, i) => (
        <Line
          key={`in-${i}`}
          points={pts}
          color={ARC_COLOR_IN}
          lineWidth={1.5}
          transparent
          opacity={0.75}
        />
      ))}
    </group>
  );
};
