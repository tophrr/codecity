
import React from 'react';
import type { LayoutNode } from '../types';
import { District } from './District';
import { Building } from './Building';

interface CityProps {
  root: LayoutNode;
  changedPaths: Set<string>;
  onSelect: (node: LayoutNode) => void;
  onHover: (path: string | null) => void;
  minDate: number;
  maxDate: number;
}

export const City: React.FC<CityProps> = ({ root, changedPaths, onSelect, onHover, minDate, maxDate }) => {
  const sharedProps = { changedPaths, onSelect, onHover, minDate, maxDate };
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
