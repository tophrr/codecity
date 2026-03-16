// Minimal standard material for now, can be upgraded with custom shader code for transitions.
import { MeshStandardMaterial } from 'three';

export class BuildingMaterial extends MeshStandardMaterial {
  constructor() {
    super({
      roughness: 0.7,
      metalness: 0.1,
    });
  }
}
