
import type { Commit, CityNode } from '../types';

/**
 * Builds the city state at a specific commit index.
 * @param commits List of all commits sorted chronologically (oldest to newest)
 * @param commitIndex Index of the commit to build state for (inclusive)
 * @returns The root CityNode representing the file tree
 */
export function buildCityAtCommit(commits: Commit[], commitIndex: number): CityNode {
    const root: CityNode = {
        name: 'root',
        path: '',
        type: 'directory',
        size: 0,
        children: []
    };

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

        // Navigate to parent dir
        let current = root;
        const stack: CityNode[] = [root]; // Track path for cleanup

        for (const part of dirParts) {
            const child = current.children?.find(c => c.name === part);
            if (!child) return; // Directory doesn't exist, can't remove file
            current = child;
            stack.push(current);
        }

        // Remove file from current dir
        if (current.children) {
            current.children = current.children.filter(c => c.name !== fileName);
        }

        // Cleanup empty directories
        // We walk up the stack. If a directory is empty (no children), remove it from its parent.
        // Note: This matches "Git behavior" (git doesn't track empty dirs).
        // But maybe we want to keep them if they were explicitly created? Git doesn't.

        // Reverse stack traversal
        for (let i = stack.length - 1; i > 0; i--) {
            const node = stack[i];
            const parent = stack[i - 1];

            // If node is empty (and not root), remove it
            if (node.children && node.children.length === 0) {
                parent.children = parent.children?.filter(c => c !== node);
            } else {
                // If not empty, stop cleaning up
                break;
            }
        }
    };

    // Apply commits
    const targetCommits = commits.slice(0, commitIndex + 1);

    for (const commit of targetCommits) {
        for (const file of commit.files) {
            const parts = file.path.split('/');
            const fileName = parts.pop();
            const dirParts = parts;

            if (!fileName) continue;

            if (file.status === 'D') {
                removeFile(file.path);
            } else {
                // A, M, or R (if handled)
                const dirNode = ensureDirectory(dirParts);

                let fileNode = dirNode.children?.find(c => c.name === fileName);
                if (!fileNode) {
                    fileNode = {
                        name: fileName,
                        path: file.path,
                        type: 'file',
                        size: 0,
                        lastModified: commit.date
                    };
                    dirNode.children = dirNode.children || [];
                    dirNode.children.push(fileNode);
                }

                // Update size (LoC)
                // Ensure size doesn't go below 0 (can happen with binary files or incorrect stats)
                fileNode.size = Math.max(0, fileNode.size + file.added - file.deleted);
                fileNode.lastModified = commit.date;
            }
        }
    }

    // Recalculate directory sizes (sum of children)?
    // Layout engine might handle that, or we do it here.
    // Usually Treemap needs value on leaf nodes. Directories accumulate.
    // Let's implement a recursive size calculator if needed, but for now leaf size is enough.

    return root;
}
