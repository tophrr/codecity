
import type { CityNode, LayoutNode } from '../types';
import * as d3 from 'd3-hierarchy';

interface LayoutConfig {
    width: number;
    height: number;
    padding: number;
}

export function computeLayout(root: CityNode, config: LayoutConfig = { width: 1000, height: 1000, padding: 2 }): LayoutNode {
    // Create hierarchy
    const hierarchy = d3.hierarchy(root)
        .sum((d) => d.type === 'file' ? d.size : 0) // Only files have size in treemap leaf nodes
        .sort((a, b) => (b.value || 0) - (a.value || 0)); // Sort by size for stability

    // Create treemap layout
    const layout = d3.treemap<CityNode>()
        .size([config.width, config.height])
        .paddingOuter(config.padding)
        .paddingInner(config.padding)
        .round(true);

    // Apply layout
    layout(hierarchy);

    // Map back to LayoutNode
    // We can traverse the hierarchy and build a new tree, or just attach properties.
    // Best to return a clean object structure.

    function mapNode(d3Node: d3.HierarchyRectangularNode<CityNode>): LayoutNode {
        return {
            ...d3Node.data,
            x: d3Node.x0,
            y: d3Node.y0,
            width: d3Node.x1 - d3Node.x0,
            height: d3Node.y1 - d3Node.y0,
            children: d3Node.children?.map(mapNode)
        };
    }

    return mapNode(hierarchy as d3.HierarchyRectangularNode<CityNode>);
}
