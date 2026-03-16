
import React, { useMemo } from 'react';
import type { LayoutNode } from '../types';
import { District } from './District';
import { InstancedBuildings } from './InstancedBuildings';

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
  
  // Flatten nodes for Instanced Mesh
  const buildings = useMemo(() => {
    const list: LayoutNode[] = [];
    const traverse = (node: LayoutNode) => {
      if (node.type === 'file') list.push(node);
      else if (node.children) node.children.forEach(traverse);
    };
    traverse(root);
    return list;
  }, [root]);

  return (
    <group>
      {root.type === 'directory' && <District node={root} {...sharedProps} />}
      <InstancedBuildings 
        nodes={buildings} 
        changedPaths={changedPaths}
        onSelect={onSelect}
        onHover={onHover}
        minDate={minDate}
        maxDate={maxDate}
      />
    </group>
  );
};
