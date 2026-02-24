import type { FlatFile } from './types';

/**
 * Churn Density — rate of change relative to file size.
 *
 *   churnᵢ = (totalAddedᵢ + totalDeletedᵢ) / max(sizeᵢ, 1)
 *
 * High churn + large size → unstable core (high risk)
 * High churn + small size → active helper / frequently tweaked utility
 * Low churn              → stable, settled file
 *
 * Returns a map of path → churn rate (unbounded above 1).
 */
export function computeChurnRates(files: FlatFile[]): Map<string, number> {
  const rates = new Map<string, number>();
  for (const f of files) {
    rates.set(f.path, (f.totalAdded + f.totalDeleted) / Math.max(f.size, 1));
  }
  return rates;
}
