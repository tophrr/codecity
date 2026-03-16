
import cloneDeep from 'lodash.clonedeep';
import type { Commit, CityNode } from '../types';

/**
 * Returns the set of file paths that changed in a specific commit.
 */
export function getCommitChangedPaths(commits: Commit[], commitIndex: number): Set<string> {
    if (commitIndex < 0 || commitIndex >= commits.length) return new Set();
    return new Set(
        commits[commitIndex].files
            .filter(f => f.status !== 'D')
            .map(f => f.path)
    );
}

const SNAPSHOT_INTERVAL = 50;
let cachedCommitsRef: Commit[] | null = null;
let snapshots = new Map<number, CityNode>();

function generateFreshRoot(): CityNode {
    return {
        name: 'root',
        path: '',
        type: 'directory',
        size: 0,
        children: []
    };
}

/**
 * Builds the city state at a specific commit index.
 * Uses snapshot caching to avoid rebuilding from scratch when scrubbing.
 * @param commits List of all commits sorted chronologically
 * @param commitIndex Index of the commit to build state for
 * @returns The root CityNode representing the file tree
 */
export function buildCityAtCommit(commits: Commit[], commitIndex: number): CityNode {
    if (commits !== cachedCommitsRef) {
        cachedCommitsRef = commits;
        snapshots.clear();
        snapshots.set(-1, generateFreshRoot());
    }

    const targetIndex = Math.max(0, Math.min(commitIndex, commits.length - 1));

    // Find the closest snapshot before or equal to targetIndex
    let nearestSnapshotIdx = -1;
    for (let i = targetIndex; i >= -1; i--) {
        if (snapshots.has(i)) {
            nearestSnapshotIdx = i;
            break;
        }
    }

    // Start with a clone of that snapshot
    const root = cloneDeep(snapshots.get(nearestSnapshotIdx)!);

    // Apply commits from nearestSnapshot + 1 up to targetIndex
    for (let i = nearestSnapshotIdx + 1; i <= targetIndex; i++) {
        applyCommit(root, commits[i]);
        
        // Save a snapshot if needed
        if (i % SNAPSHOT_INTERVAL === 0 && !snapshots.has(i)) {
            snapshots.set(i, cloneDeep(root));
        }
    }

    return root;
}

function applyCommit(root: CityNode, commit: Commit) {
    // Helper to find or create directory
    const ensureDirectory = (pathParts: string[]): CityNode => {
        let current = root;
        let currentPath = '';

        for (const part of pathParts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            let child = current.children?.find(c => c.name === part);
            if (!child) {
                child = {
                    name: part,
                    path: currentPath,
                    type: 'directory',
                    size: 0,
                    children: []
                };
                current.children = current.children || [];
                current.children.push(child);
            }
            current = child;
        }
        return current;
    };

    // Helper to remove file node
    const removeFile = (filePath: string) => {
        const parts = filePath.split('/');
        const fileName = parts.pop();
        const dirParts = parts;

        let current = root;
        const stack: CityNode[] = [root];

        for (const part of dirParts) {
            const child = current.children?.find(c => c.name === part);
            if (!child) return;
            current = child;
            stack.push(current);
        }

        if (current.children) {
            current.children = current.children.filter(c => c.name !== fileName);
        }

        for (let i = stack.length - 1; i > 0; i--) {
            const node = stack[i];
            const parent = stack[i - 1];
            if (node.children && node.children.length === 0) {
                parent.children = parent.children?.filter(c => c !== node);
            } else {
                break;
            }
        }
    };

    // Apply commits
    for (const file of commit.files) {
        const parts = file.path.split('/');
        const fileName = parts.pop();
        const dirParts = parts;

        if (!fileName) continue;

        if (file.status === 'D') {
            removeFile(file.path);
        } else {
            const dirNode = ensureDirectory(dirParts);

            let fileNode = dirNode.children?.find(c => c.name === fileName);
            if (!fileNode) {
                fileNode = {
                    name: fileName,
                    path: file.path,
                    type: 'file',
                    size: 0,
                    lastModified: commit.date,
                    totalAdded: 0,
                    totalDeleted: 0,
                };
                dirNode.children = dirNode.children || [];
                dirNode.children.push(fileNode);
            }

            fileNode.size = Math.max(0, fileNode.size + file.added - file.deleted);
            fileNode.lastModified = commit.date;
            fileNode.totalAdded = (fileNode.totalAdded ?? 0) + file.added;
            fileNode.totalDeleted = (fileNode.totalDeleted ?? 0) + file.deleted;
        }
    }
}
