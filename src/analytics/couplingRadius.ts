import type { FlatFile } from './types';

/**
 * Coupling Radius — average Euclidean XZ distance of dependency arcs.
 *
 *   Cᵣ = (1/|E|) Σ_{(u,v)∈E} √( (xᵤ−xᵥ)² + (zᵤ−zᵥ)² )
 *
 * Low  → imports stay nearby (local, cohesive)
 * High → imports span across the city (tight cross-module coupling)
 *
 * Per-district value = average over all arcs where at least one
 * endpoint belongs to the district.
 */

export interface ArcRecord {
  from: string;
  to: string;
  dist: number;
}

/** Precompute every arc length once from the flat file index + deps map. */
export function buildArcRecords(
  fileIndex: Map<string, FlatFile>,
  deps: Record<string, string[]>,
): ArcRecord[] {
  const arcs: ArcRecord[] = [];
  for (const [from, targets] of Object.entries(deps)) {
    const f = fileIndex.get(from);
    if (!f) continue;
    for (const to of targets) {
      const t = fileIndex.get(to);
      if (!t) continue;
      const dx = f.wx - t.wx;
      const dz = f.wz - t.wz;
      arcs.push({ from, to, dist: Math.sqrt(dx * dx + dz * dz) });
    }
  }
  return arcs;
}

export function globalAvgCouplingRadius(arcs: ArcRecord[]): number {
  if (arcs.length === 0) return 0;
  return arcs.reduce((s, a) => s + a.dist, 0) / arcs.length;
}

export function districtAvgCouplingRadius(
  districtPath: string,
  arcs: ArcRecord[],
  fileIndex: Map<string, FlatFile>,
): number {
  const relevant = arcs.filter(a => {
    const from = fileIndex.get(a.from);
    const to   = fileIndex.get(a.to);
    return from?.districtPath === districtPath || to?.districtPath === districtPath;
  });
  if (relevant.length === 0) return 0;
  return relevant.reduce((s, a) => s + a.dist, 0) / relevant.length;
}
