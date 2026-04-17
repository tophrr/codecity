import type { FlatFile } from './types';

/**
 * Abandoned Zone Detection — likely dead code candidates.
 *
 * A file is flagged as abandoned when ALL of:
 *   1. inDegree = 0   (nothing imports it)
 *   2. lastModified age ≥ 75th percentile across all files
 *      (it hasn't been touched in a long time relative to the rest)
 *   3. size > 10 LoC  (exclude trivial stubs)
 *
 * Visualisation signal: cold color + zero incoming arcs = ghost file.
 */
export function computeAbandonedFlags(
  files: FlatFile[],
  inDegrees: Map<string, number>,
  config: { abandonedPercentile: number }
): Set<string> {
  // Build 75th-percentile cutoff of lastModified (older = smaller timestamp)
  const timestamps = files
    .filter(f => f.lastModified)
    .map(f => new Date(f.lastModified!).getTime())
    .sort((a, b) => a - b);

  const pIndex = Math.floor(timestamps.length * config.abandonedPercentile);
  const ageCutoff = timestamps[pIndex] ?? 0; // files modified before this are "old"

  const abandoned = new Set<string>();
  for (const f of files) {
    if (f.size <= 10) continue;
    if ((inDegrees.get(f.path) ?? 0) > 0) continue;
    const ts = f.lastModified ? new Date(f.lastModified).getTime() : 0;
    if (ts <= ageCutoff) abandoned.add(f.path);
  }
  return abandoned;
}
