import type { FlatFile, DistrictMetrics } from './types';

/**
 * Skyline Roughness — coefficient of variation of building heights per district.
 *
 *   σ_h = √( (1/n) Σ(hᵢ - h̄)² )
 *   R   = σ_h / h̄
 *
 * R → 0 : all buildings same height (uniform file sizes, good)
 * R → ∞ : one skyscraper surrounded by shacks (god-file risk)
 */
export function computeSkylineRoughness(
  files: FlatFile[],
): number {
  if (files.length < 2) return 0;
  const heights = files.map(f => f.wh);
  const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
  if (mean === 0) return 0;
  const variance = heights.reduce((s, h) => s + (h - mean) ** 2, 0) / heights.length;
  return Math.sqrt(variance) / mean; // coefficient of variation
}

/** Augment district metrics records with skyline roughness. */
export function applySkylineRoughness(
  districts: Map<string, { files: FlatFile[]; partial: Partial<DistrictMetrics> }>,
): void {
  for (const [, d] of districts) {
    d.partial.skylineRoughness = computeSkylineRoughness(d.files);
    d.partial.avgHeight = d.files.length
      ? d.files.reduce((s, f) => s + f.wh, 0) / d.files.length
      : 0;
    d.partial.fileCount = d.files.length;
  }
}
