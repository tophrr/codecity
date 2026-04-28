import React, { useMemo, useState } from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

export type PositionMap = Map<string, [number, number, number]>; // path → [x, y_top, z]

interface DependencyArcsProps {
  hoveredPath: string | null;
  deps: Record<string, string[]>;
  positionMap: PositionMap;
  showAll?: boolean;
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
): { points: THREE.Vector3[], midPoint: THREE.Vector3 } {
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

  const points = quadraticBezierPoints(start, ctrl, end, ARC_SEGMENTS);
  const midPoint = points[Math.floor(points.length / 2)];

  return { points, midPoint };
}

interface ArcData {
  id: string;
  points: THREE.Vector3[];
  from: string;
  to: string;
  type: 'incoming' | 'outgoing';
  midPoint: THREE.Vector3;
}

export const DependencyArcs: React.FC<DependencyArcsProps> = ({
  hoveredPath,
  deps,
  positionMap,
  showAll = false,
}) => {
  const [hoveredArcId, setHoveredArcId] = useState<string | null>(null);

  const arcs = useMemo(() => {
    const outgoing: ArcData[] = [];
    const incoming: ArcData[] = [];

    if (showAll) {
      // In showAll mode, we render all outgoing dependencies from all files
      for (const [source, targets] of Object.entries(deps)) {
        const fromPos = positionMap.get(source);
        if (!fromPos) continue;

        for (const target of targets) {
          const toPos = positionMap.get(target);
          if (toPos) {
            outgoing.push({
              id: `out-${source}-${target}`,
              from: source,
              to: target,
              type: 'outgoing',
              ...buildArcPoints(fromPos, toPos),
            });
          }
        }
      }
    } else if (hoveredPath) {
      const fromPos = positionMap.get(hoveredPath);
      if (fromPos) {
        // Outgoing: what this file imports
        const targets = deps[hoveredPath] ?? [];
        for (const target of targets) {
          const toPos = positionMap.get(target);
          if (toPos) {
            outgoing.push({
              id: `out-${hoveredPath}-${target}`,
              from: hoveredPath,
              to: target,
              type: 'outgoing',
              ...buildArcPoints(fromPos, toPos),
            });
          }
        }

        // Incoming: what imports this file (reverse lookup)
        for (const [importer, importees] of Object.entries(deps)) {
          if (importees.includes(hoveredPath)) {
            const fromImporterPos = positionMap.get(importer);
            if (fromImporterPos) {
              incoming.push({
                id: `in-${importer}-${hoveredPath}`,
                from: importer,
                to: hoveredPath,
                type: 'incoming',
                ...buildArcPoints(fromImporterPos, fromPos),
              });
            }
          }
        }
      }
    }

    if (outgoing.length === 0 && incoming.length === 0) return null;

    return { outgoing, incoming };
  }, [hoveredPath, deps, positionMap, showAll]);

  if (!arcs) return null;

  const renderTooltip = (arc: ArcData) => {
    if (hoveredArcId !== arc.id) return null;
    return (
      <Html position={arc.midPoint} center style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(0,0,0,0.8)', padding: '6px 10px', borderRadius: '4px', color: '#fff', fontSize: '12px', whiteSpace: 'nowrap', border: `1px solid ${arc.type === 'outgoing' ? ARC_COLOR_OUT : ARC_COLOR_IN}` }}>
          <strong>{arc.type === 'outgoing' ? 'Imports' : 'Imported by'}:</strong><br/>
          {arc.type === 'outgoing' ? (
            <>
              From: <span style={{ color: '#ccc' }}>{arc.from}</span><br />
              Target: <span style={{ color: '#4af0ff' }}>{arc.to}</span>
            </>
          ) : (
            <>
              Source: <span style={{ color: '#ff6a00' }}>{arc.from}</span><br />
              To: <span style={{ color: '#ccc' }}>{arc.to}</span>
            </>
          )}
        </div>
      </Html>
    );
  };

  return (
    <group>
      {arcs.outgoing.map((arc) => (
        <group key={arc.id}>
          <Line
            points={arc.points}
            color={ARC_COLOR_OUT}
            lineWidth={hoveredArcId === arc.id ? 4 : 1.5}
            transparent
            opacity={hoveredArcId === arc.id ? 1 : 0.85}
            onPointerOver={(e) => { e.stopPropagation(); setHoveredArcId(arc.id); }}
            onPointerOut={(e) => { e.stopPropagation(); setHoveredArcId(null); }}
          />
          {renderTooltip(arc)}
        </group>
      ))}
      {arcs.incoming.map((arc) => (
        <group key={arc.id}>
          <Line
            points={arc.points}
            color={ARC_COLOR_IN}
            lineWidth={hoveredArcId === arc.id ? 4 : 1.5}
            transparent
            opacity={hoveredArcId === arc.id ? 1 : 0.75}
            onPointerOver={(e) => { e.stopPropagation(); setHoveredArcId(arc.id); }}
            onPointerOut={(e) => { e.stopPropagation(); setHoveredArcId(null); }}
          />
          {renderTooltip(arc)}
        </group>
      ))}
    </group>
  );
};
