import type { LayoutNode } from '../types';

/** A flattened file record with world position, extracted once from the layout tree. */
export interface FlatFile {
  path: string;
  name: string;
  wx: number;   // world X (treemap center)
  wz: number;   // world Z (treemap center)
  wh: number;   // world height (= size * 0.1, clamped)
  size: number; // LoC
  lastModified?: string;
  totalAdded: number;
  totalDeleted: number;
  districtPath: string; // immediate parent directory path
}

export interface FileMetrics {
  path: string;
  inDegree: number;
  outDegree: number;
  /** Martin instability: outDegree / (inDegree + outDegree), 0=stable, 1=unstable */
  instability: number;
  /** Normalised hub score: inDegree / (n - 1) */
  hubScore: number;
  isAbandoned: boolean;
  /** (totalAdded + totalDeleted) / size */
  churnRate: number;
}

export interface DistrictMetrics {
  path: string;
  name: string;
  fileCount: number;
  avgHeight: number;
  /** Coefficient of variation of building heights — low = uniform files */
  skylineRoughness: number;
  /** Fraction of edges that stay within this district (0–1) */
  modularityIndex: number;
  /** Average Euclidean XZ distance of arcs crossing this district */
  avgCouplingRadius: number;
  /** Avg instability of files in this district */
  avgInstability: number;
  /** Composite 0–100 health score */
  healthScore: number;
}

export interface CityMetrics {
  /** 0–100 — how self-contained districts are */
  modularityScore: number;
  /** 0–100 — penalises hubs, instability, abandoned files */
  scalabilityScore: number;
  avgCouplingRadius: number;
  hubFiles: FileMetrics[];
  abandonedFiles: FileMetrics[];
  avgInstability: number;
  districts: DistrictMetrics[];
  files: FileMetrics[];
}

/** Walk the layout tree and collect every leaf (file) with world coordinate. */
export function flattenFiles(
  node: LayoutNode,
  parentPath = '',
  out: FlatFile[] = [],
): FlatFile[] {
  if (node.type === 'file') {
    out.push({
      path: node.path,
      name: node.name,
      wx: node.x + node.width / 2,
      wz: node.y + node.height / 2,
      wh: Math.max(0.2, node.size * 0.1),
      size: node.size,
      lastModified: node.lastModified,
      totalAdded: node.totalAdded ?? 0,
      totalDeleted: node.totalDeleted ?? 0,
      districtPath: parentPath,
    });
  } else if (node.children) {
    for (const child of node.children) {
      flattenFiles(child, node.path, out);
    }
  }
  return out;
}
