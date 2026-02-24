import type { FlatFile, FileMetrics } from './types';

/**
 * Hub Detection & Fan-Out Instability.
 *
 * Hub Score (per file):
 *   Hᵢ = inᵢ / (n − 1)
 *
 *   High Hᵢ + hot color  → high-risk central file (everything depends on it)
 *   High Hᵢ + cold color → stable core abstraction
 *
 * Martin Instability (per file):
 *   Iᵢ = outᵢ / (inᵢ + outᵢ)
 *
 *   Iᵢ = 0 : maximally stable (depended-on, depends on nothing)
 *   Iᵢ = 1 : maximally unstable (depends on many, nothing depends on it)
 *
 * Hub threshold: top 5% by in-degree.
 */
export function computeHubAndInstability(
  files: FlatFile[],
  deps: Record<string, string[]>,
): Map<string, Pick<FileMetrics, 'inDegree' | 'outDegree' | 'instability' | 'hubScore'>> {
  const n = files.length;
  const inDegree  = new Map<string, number>(files.map(f => [f.path, 0]));
  const outDegree = new Map<string, number>(files.map(f => [f.path, 0]));

  for (const [from, targets] of Object.entries(deps)) {
    outDegree.set(from, targets.length);
    for (const to of targets) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }
  }

  const result = new Map<string, Pick<FileMetrics, 'inDegree' | 'outDegree' | 'instability' | 'hubScore'>>();
  for (const f of files) {
    const inn  = inDegree.get(f.path)  ?? 0;
    const out  = outDegree.get(f.path) ?? 0;
    const denom = inn + out;
    result.set(f.path, {
      inDegree:    inn,
      outDegree:   out,
      instability: denom === 0 ? 0 : out / denom,
      hubScore:    n > 1 ? inn / (n - 1) : 0,
    });
  }
  return result;
}
