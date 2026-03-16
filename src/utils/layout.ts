
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
        // Give minimum size (e.g., 10) to prevent 0-size files from vanishing and shifting layout
        .sum((d) => d.type === 'file' ? Math.max(10, d.size) : 0)
        // Sort alphabetically by name for layout stability ("Stable Treemap")
        .sort((a, b) => a.data.name.localeCompare(b.data.name));

    // Create treemap layout using Resquarify for better stability across updates
    const layout = d3.treemap<CityNode>()
        .tile(d3.treemapResquarify)
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
