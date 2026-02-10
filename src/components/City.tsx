
import React from 'react';
import type { LayoutNode } from '../types';
import { District } from './District';
import { Building } from './Building';

interface CityProps {
  root: LayoutNode;
}

export const City: React.FC<CityProps> = ({ root }) => {
  return (
    <group>
      {root.type === 'directory' ? (
        <District node={root} />
      ) : (
        <Building node={root} />
      )}
    </group>
  );
};
