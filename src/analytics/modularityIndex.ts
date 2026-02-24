import type { FlatFile } from './types';

/**
 * Per-district Modularity Index (kept for district-detail display).
 *
 *   Mᵈ = |E_intra| / |E_total|
 */
export function computeModularityIndex(
  districtPath: string,
  fileIndex: Map<string, FlatFile>,
  deps: Record<string, string[]>,
): number {
  let intra = 0;
  let total = 0;

  for (const [from, targets] of Object.entries(deps)) {
    const fFrom = fileIndex.get(from);
    if (!fFrom) continue;
    const fromIn = fFrom.districtPath === districtPath;

    for (const to of targets) {
      const fTo = fileIndex.get(to);
      if (!fTo) continue;
      const toIn = fTo.districtPath === districtPath;

      if (fromIn || toIn) {
        total++;
        if (fromIn && toIn) intra++;
      }
    }
  }

  return total === 0 ? 1 : intra / total;
}

/**
 * Newman-Girvan Q (weighted, LoC-aware) — city-wide modularity score.
 *
 * Each directed edge i→j gets weight  wᵢⱼ = log(1 + sizeᵢ)
 * so large files count more than tiny glue files.
 *
 *   Q = Σ_c [ eᶜ/W − (aᶜ/W)² ]
 *
 *   eᶜ  = total weight of edges where BOTH endpoints are in community c
 *   aᶜ  = total weight of edges incident to any node in c (in or out)
 *   W   = total weight of all edges
 *
 * Q ∈ (−0.5, 1].
 *   Q > 0.3  → meaningful community structure
 *   Q ≈ 0   → no better than a random graph
 *   Q < 0   → imports more cross-boundary than a random graph would
 *
 * We map to [0, 100] as:  score = clamp((Q + 0.5) / 1.5 × 100, 0, 100)
 * so Q=0 → 33, Q=0.5 → 67, Q=1 → 100, Q=−0.5 → 0.
 */
export function computeNewmanGirvanQ(
  fileIndex: Map<string, FlatFile>,
  deps: Record<string, string[]>,
): number {
  // community label per file = districtPath
  const communityOf = (path: string) => fileIndex.get(path)?.districtPath ?? '__unknown__';

  // Accumulate per-community stats
  const eMap  = new Map<string, number>(); // intra-community edge weight
  const aMap  = new Map<string, number>(); // total incident weight
  let W = 0;

  for (const [from, targets] of Object.entries(deps)) {
    const fFrom = fileIndex.get(from);
    if (!fFrom) continue;
    const w = Math.log1p(fFrom.size); // LoC weight
    const cFrom = communityOf(from);

    for (const to of targets) {
      if (!fileIndex.has(to)) continue;
      const cTo = communityOf(to);
      W += w;

      // incident weight counts for the source community
      aMap.set(cFrom, (aMap.get(cFrom) ?? 0) + w);
      // also counts for the target community (undirected treatment for degree sum)
      aMap.set(cTo,   (aMap.get(cTo)   ?? 0) + w);

      if (cFrom === cTo) {
        eMap.set(cFrom, (eMap.get(cFrom) ?? 0) + w);
      }
    }
  }

  if (W === 0) return 0;

  let Q = 0;
  const communities = new Set([...eMap.keys(), ...aMap.keys()]);
  for (const c of communities) {
    const e = (eMap.get(c) ?? 0) / W;
    const a = (aMap.get(c) ?? 0) / (2 * W); // divide by 2W for undirected degree sum
    Q += e - a * a;
  }

  return Q;
}
