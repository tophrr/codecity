
export interface CommitFile {
    path: string;
    added: number;
    deleted: number;
    status: 'A' | 'M' | 'D' | 'R';
}

export interface Commit {
    hash: string;
    date: string;
    message: string;
    author_name: string;
    author_email: string;
    files: CommitFile[];
}

export interface CityNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size: number;
    children?: CityNode[];
    lastModified?: string;
    totalAdded?: number;
    totalDeleted?: number;
}

export interface LayoutNode extends CityNode {
    x: number;
    y: number;
    width: number;
    height: number;
    children?: LayoutNode[];
}

export interface LayoutConfig {
    width: number;
    height: number;
    padding: number;
}

export interface CityConfig {
    layout: LayoutConfig;
    verticalScale: number;
    colorPalette: string;
    district: {
        lotHeight: number;
        lotDepthStep: number;
    };
    scene: {
        bloomIntensity: number;
        bloomThreshold: number;
    };
    analytics: {
        abandonedPercentile: number;
    };
}
