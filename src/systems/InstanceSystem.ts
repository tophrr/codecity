import { InstancedMesh, Matrix4, Color } from 'three';
import type { LayoutNode } from '../types';

export class InstanceSystem {
  mesh: InstancedMesh | null = null;
  nodes: LayoutNode[] = [];
  changedPaths: Set<string> = new Set();
  minDate: number = 0;
  maxDate: number = 0;

  private tempMatrix = new Matrix4();
  private tempColor = new Color();

  // Cold color (old files)
  private COLD = new Color('#3a6b9e');
  // Hot color (recent files)
  private HOT = new Color('#ff5500');

  setMesh(mesh: InstancedMesh) {
    this.mesh = mesh;
  }

  update(nodes: LayoutNode[], changedPaths: Set<string>, minDate: number, maxDate: number) {
    this.nodes = nodes;
    this.changedPaths = changedPaths;
    this.minDate = minDate;
    this.maxDate = maxDate;

    if (!this.mesh) return;

    this.mesh.count = nodes.length;

    const MIN_FOOTPRINT = 1.0;
    const SIGMOID_K = 4;
    const softMin = (val: number) => {
      const t = 1 / (1 + Math.exp(-SIGMOID_K * (val - MIN_FOOTPRINT)));
      return MIN_FOOTPRINT * (1 - t) + val * t;
    };

    nodes.forEach((node, i) => {
      const targetH = Math.max(0.2, node.size * 0.1);
      const w = node.width;
      const d = node.height;
      const bw = softMin(w) * 0.88; 
      const bd = softMin(d) * 0.88; 
      const x = node.x + w / 2;
      const z = node.y + d / 2;

      // Position & Scale
      this.tempMatrix.makeScale(bw, targetH, bd);
      this.tempMatrix.setPosition(x, targetH / 2, z);
      this.mesh!.setMatrixAt(i, this.tempMatrix);

      // Color based on recency
      const dateMs = node.lastModified ? new Date(node.lastModified).getTime() : minDate;
      const range = maxDate - minDate || 1;
      const recency = Math.max(0, Math.min(1, (dateMs - minDate) / range));
      this.tempColor.copy(this.COLD).lerp(this.HOT, recency);
      
      this.mesh!.setColorAt(i, this.tempColor);
    });

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export const instanceSystem = new InstanceSystem();
