import type { LayoutNode } from '../types';
import type { CityMetrics, DistrictMetrics, FileMetrics, FlatFile } from './types';
import { flattenFiles } from './types';
import { applySkylineRoughness } from './skylineRoughness';
import { buildArcRecords, globalAvgCouplingRadius, districtAvgCouplingRadius } from './couplingRadius';
import { computeModularityIndex, computeNewmanGirvanQ } from './modularityIndex';
import { computeHubAndInstability } from './hubDetection';
import { computeAbandonedFlags } from './abandonedZones';
import { computeChurnRates } from './churnDensity';

/**
 * Run every analytics pass over the current layout + deps and return a
 * fully-populated CityMetrics object for display in the analytics panel.
 */
export function computeCityMetrics(
  root: LayoutNode,
  deps: Record<string, string[]>,
): CityMetrics {
  // ── 1. Flatten layout tree into file list ──────────────────────────────────
  const allFiles: FlatFile[] = flattenFiles(root);
  const fileIndex = new Map<string, FlatFile>(allFiles.map(f => [f.path, f]));

  // ── 2. Group files by immediate parent district ────────────────────────────
  const districtMap = new Map<string, { name: string; files: FlatFile[]; partial: Partial<DistrictMetrics> }>();
  for (const f of allFiles) {
    if (!districtMap.has(f.districtPath)) {
      districtMap.set(f.districtPath, {
        name: f.districtPath.split('/').pop() ?? f.districtPath,
        files: [],
        partial: { path: f.districtPath, name: f.districtPath.split('/').pop() ?? f.districtPath },
      });
    }
    districtMap.get(f.districtPath)!.files.push(f);
  }

  // ── 3. Skyline roughness + avg height (per district) ──────────────────────
  applySkylineRoughness(districtMap);

  // ── 4. Arc records (precomputed once) ─────────────────────────────────────
  const arcs = buildArcRecords(fileIndex, deps);
  const globalCR = globalAvgCouplingRadius(arcs);

  // ── 5. Hub scores + instability (per file) ────────────────────────────────
  const hubInstMap = computeHubAndInstability(allFiles, deps);

  // ── 6. Churn rates (per file) ─────────────────────────────────────────────
  const churnMap = computeChurnRates(allFiles);

  // ── 7. Abandoned zones ────────────────────────────────────────────────────
  const inDegrees = new Map<string, number>(allFiles.map(f => [f.path, 0]));
  for (const [, targets] of Object.entries(deps)) {
    for (const t of targets) inDegrees.set(t, (inDegrees.get(t) ?? 0) + 1);
  }
  const abandonedSet = computeAbandonedFlags(allFiles, inDegrees);

  // ── 8. Assemble per-file metrics ──────────────────────────────────────────
  const fileMetrics: FileMetrics[] = allFiles.map(f => {
    const hi = hubInstMap.get(f.path)!;
    return {
      path:        f.path,
      inDegree:    hi.inDegree,
      outDegree:   hi.outDegree,
      instability: hi.instability,
      hubScore:    hi.hubScore,
      isAbandoned: abandonedSet.has(f.path),
      churnRate:   churnMap.get(f.path) ?? 0,
    };
  });
  const fileMetricsIndex = new Map(fileMetrics.map(fm => [fm.path, fm]));

  // ── 9. Assemble per-district metrics ──────────────────────────────────────
  const districts: DistrictMetrics[] = [];

  for (const [distPath, d] of districtMap) {
    const modularity = computeModularityIndex(distPath, fileIndex, deps);
    const cr         = districtAvgCouplingRadius(distPath, arcs, fileIndex);
    const avgInst    = d.files.length
      ? d.files.reduce((s, f) => s + (fileMetricsIndex.get(f.path)?.instability ?? 0), 0) / d.files.length
      : 0;

    // Health = low roughness × high modularity × low instability
    const roughness = d.partial.skylineRoughness ?? 0;
    const roughnessPenalty = Math.min(roughness / 2, 1); // cap at 2.0 CV
    const healthScore = Math.round(
      100 * (1 - roughnessPenalty) * modularity * (1 - avgInst)
    );

    districts.push({
      path:                d.partial.path ?? distPath,
      name:                d.partial.name ?? distPath,
      fileCount:           d.files.length,
      avgHeight:           d.partial.avgHeight ?? 0,
      skylineRoughness:    d.partial.skylineRoughness ?? 0,
      modularityIndex:     modularity,
      avgCouplingRadius:   cr,
      avgInstability:      avgInst,
      healthScore:         Math.max(0, Math.min(100, healthScore)),
    });
  }

  // ── 10. City-wide composite scores ────────────────────────────────────────

  // Modularity: Newman-Girvan Q (LoC-weighted), mapped from [-0.5,1] → [0,100]
  const Q = computeNewmanGirvanQ(fileIndex, deps);
  const modularityScore = Math.round(Math.max(0, Math.min(100, (Q + 0.5) / 1.5 * 100)));

  const avgInstability = fileMetrics.length
    ? fileMetrics.reduce((s, f) => s + f.instability, 0) / fileMetrics.length
    : 0;

  const hubFiles       = fileMetrics.filter(f => f.hubScore > 0.05).sort((a, b) => b.hubScore - a.hubScore);
  const abandonedFiles = fileMetrics.filter(f => f.isAbandoned);

  // Hub concentration: fraction of total in-degree held by the top-10% most-imported files.
  // 0 = flat/equal distribution, 1 = one file gets all imports.
  const sortedByIn = [...fileMetrics].sort((a, b) => b.inDegree - a.inDegree);
  const top10Count = Math.max(1, Math.ceil(sortedByIn.length * 0.1));
  const totalInDegree = sortedByIn.reduce((s, f) => s + f.inDegree, 0);
  const top10InDegree = sortedByIn.slice(0, top10Count).reduce((s, f) => s + f.inDegree, 0);
  const hubConcentration = totalInDegree === 0 ? 0 : top10InDegree / totalInDegree;

  // Dead-code ratio: fraction of all files flagged as abandoned.
  const deadCodeRatio = fileMetrics.length === 0 ? 0 : abandonedFiles.length / fileMetrics.length;

  // Scalability:
  //   - Hub concentration penalty (weight 0.4): Pareto-like, how top-heavy the dependency graph is
  //   - Dead-code penalty (weight 0.4): how much of the codebase is unused
  //   - Mean instability penalty (weight 0.2): average Martin instability
  const scalabilityScore = Math.round(
    100
    * (1 - 0.4 * hubConcentration)
    * (1 - 0.4 * deadCodeRatio)
    * (1 - 0.2 * avgInstability)
  );

  return {
    modularityScore:  Math.max(0, Math.min(100, modularityScore)),
    scalabilityScore: Math.max(0, Math.min(100, scalabilityScore)),
    avgCouplingRadius: globalCR,
    hubFiles:         hubFiles.slice(0, 10),
    abandonedFiles:   abandonedFiles.slice(0, 10),
    avgInstability,
    districts,
    files: fileMetrics,
  };
}

export type { CityMetrics, DistrictMetrics, FileMetrics };
