
import React from 'react';
import type { LayoutNode } from '../types';
import { District } from './District';
import { Building } from './Building';

interface CityProps {
  root: LayoutNode;
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  minDate: number;
  maxDate: number;
}

export const City: React.FC<CityProps> = ({ root, changedPaths, onSelect, minDate, maxDate }) => {
  const sharedProps = { changedPaths, onSelect, minDate, maxDate };
  return (
    <group>
      {root.type === 'directory' ? (
        <District node={root} {...sharedProps} />
      ) : (
        <Building node={root} {...sharedProps} />
      )}
    </group>
  );
};
