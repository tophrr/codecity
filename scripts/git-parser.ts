
import { simpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_PATH = 'C:\\Users\\LENOVO\\Documents\\go\\typego';

const git = simpleGit(REPO_PATH);
const outputDir = path.resolve(__dirname, '../src/data');
const outputFile = path.join(outputDir, 'commits.json');
const depsFile   = path.join(outputDir, 'deps.json');

const BLACKLIST_EXTENSIONS = ['.d.ts', '.lock', '.json', '.md'];
const BLACKLIST_PATHS = ['node_modules/', '.typego/'];

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// ─── Language extractors ────────────────────────────────────────────────────

/**
 * Extract all import paths from a TypeScript / JavaScript file's content.
 * Returns raw specifier strings (relative or bare).
 */
function extractTsImports(content: string): string[] {
    const results: string[] = [];
    // ES module: import ... from '...' or import('...')
    const esModuleRe = /(?:import\s+(?:.*?\s+from\s+)?|import\s*\()\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = esModuleRe.exec(content)) !== null) results.push(m[1]);
    // CommonJS: require('...')
    const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = requireRe.exec(content)) !== null) results.push(m[1]);
    return results;
}

/**
 * Extract import paths from a Go file's content.
 * Returns raw import path strings.
 */
function extractGoImports(content: string): string[] {
    const results: string[] = [];
    // Multi-line import block: import ( "path/a" "path/b" )
    const blockRe = /import\s*\(([\s\S]*?)\)/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(content)) !== null) {
        const block = m[1];
        const lineRe = /["']([^"']+)["']/g;
        let lm: RegExpExecArray | null;
        while ((lm = lineRe.exec(block)) !== null) results.push(lm[1]);
    }
    // Single-line: import "path"
    const singleRe = /^import\s+["']([^"']+)["']/gm;
    while ((m = singleRe.exec(content)) !== null) results.push(m[1]);
    return results;
}

// ─── Path resolvers ─────────────────────────────────────────────────────────

/**
 * Resolve a TS/JS relative specifier against the importing file's path.
 * Returns a normalized repo-relative path, or null if external.
 */
function resolveTsSpecifier(specifier: string, importingFile: string, knownPaths: Set<string>): string | null {
    if (!specifier.startsWith('.')) return null; // external package — skip
    const dir = path.dirname(importingFile).replace(/\\/g, '/');
    const base = path.posix.normalize(`${dir}/${specifier}`);
    // Try exact, then common extensions, then /index variants
    const candidates = [
        base,
        `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`,
        `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`,
    ];
    for (const c of candidates) {
        if (knownPaths.has(c)) return c;
    }
    return null;
}

/**
 * Resolve a Go import path against the detected module name.
 * Returns the repo-relative DIRECTORY path, or null if external.
 */
function resolveGoSpecifier(specifier: string, goModuleName: string, knownDirs: Set<string>): string | null {
    if (!specifier.startsWith(goModuleName + '/')) return null; // external
    const repoRelativeDir = specifier.slice(goModuleName.length + 1); // e.g. "pkg/logger"
    return knownDirs.has(repoRelativeDir) ? repoRelativeDir : null;
}

// ─── Go module name auto-detection ──────────────────────────────────────────

async function detectGoModuleName(): Promise<string | null> {
    try {
        const content = await git.show(['HEAD:go.mod']);
        const m = content.match(/^module\s+(\S+)/m);
        return m ? m[1] : null;
    } catch {
        return null; // no go.mod in this repo
    }
}

// ─── Dependency extraction pass ─────────────────────────────────────────────

async function parseDeps(liveFiles: string[]): Promise<Record<string, string[]>> {
    console.log(`Parsing dependencies for ${liveFiles.length} live files...`);

    const knownPaths = new Set(liveFiles);

    // Build set of known Go directories from live .go files
    const knownGoDirs = new Set(liveFiles.filter(f => f.endsWith('.go')).map(f => path.dirname(f).replace(/\\/g, '/')));

    const goModuleName = await detectGoModuleName();
    if (goModuleName) console.log(`  Detected Go module: ${goModuleName}`);

    const deps: Record<string, string[]> = {};
    let processed = 0;

    for (const filePath of liveFiles) {
        const ext = filePath.split('.').pop() ?? '';
        const isTsJs = ['ts', 'tsx', 'js', 'jsx'].includes(ext);
        const isGo   = ext === 'go';

        if (!isTsJs && !isGo) continue;

        let content: string;
        try {
            content = await git.show([`HEAD:${filePath}`]);
        } catch {
            continue; // deleted between index and HEAD, skip
        }

        let specifiers: string[];
        if (isTsJs) {
            specifiers = extractTsImports(content);
        } else {
            specifiers = extractGoImports(content);
        }

        const resolved: string[] = [];
        for (const spec of specifiers) {
            let target: string | null = null;
            if (isTsJs) {
                target = resolveTsSpecifier(spec, filePath, knownPaths);
            } else if (isGo && goModuleName) {
                const dir = resolveGoSpecifier(spec, goModuleName, knownGoDirs);
                // Map directory → representative .go file (first one in that dir)
                if (dir) {
                    const rep = liveFiles.find(f => f.startsWith(dir + '/') && f.endsWith('.go'));
                    target = rep ?? null;
                }
            }
            if (target && target !== filePath && !resolved.includes(target)) {
                resolved.push(target);
            }
        }

        if (resolved.length > 0) {
            deps[filePath] = resolved;
        }

        processed++;
        if (processed % 50 === 0) console.log(`  ... ${processed}/${liveFiles.length}`);
    }

    return deps;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
    console.log('Parsing Git log...');
    try {
        const separator = '|||';
        const format = `COMMIT:${separator}%H${separator}%aI${separator}%an${separator}%ae${separator}%s`;

        const logOutput = await git.raw([
            'log',
            `--pretty=format:${format}`,
            '--numstat',
            '--summary',
            '--no-merges',
            '--reverse'
        ]);

        const commits: any[] = [];
        let currentCommit: any = null;

        for (const line of logOutput.split('\n')) {
            if (line.trim() === '') continue;

            if (line.startsWith(`COMMIT:${separator}`)) {
                if (currentCommit) commits.push(currentCommit);
                const parts = line.split(separator);
                currentCommit = {
                    hash: parts[1], date: parts[2],
                    author_name: parts[3], author_email: parts[4],
                    message: parts[5], files: []
                };
            } else if (currentCommit) {
                const numstatMatch = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
                if (numstatMatch) {
                    const filePath = numstatMatch[3];
                    const shouldSkip =
                        BLACKLIST_EXTENSIONS.some(ext => filePath.endsWith(ext)) ||
                        BLACKLIST_PATHS.some(p => filePath.includes(p));
                    if (shouldSkip) continue;

                    const added   = numstatMatch[1] === '-' ? 0 : parseInt(numstatMatch[1], 10);
                    const deleted = numstatMatch[2] === '-' ? 0 : parseInt(numstatMatch[2], 10);
                    currentCommit.files.push({ path: filePath, added, deleted, status: 'M' });
                    continue;
                }

                const createMatch = line.match(/\s*create mode \d+ (.+)/);
                if (createMatch) {
                    const fe = currentCommit.files.find((f: any) => f.path === createMatch[1]);
                    if (fe) fe.status = 'A';
                    continue;
                }

                const deleteMatch = line.match(/\s*delete mode \d+ (.+)/);
                if (deleteMatch) {
                    const fe = currentCommit.files.find((f: any) => f.path === deleteMatch[1]);
                    if (fe) fe.status = 'D';
                    continue;
                }
            }
        }
        if (currentCommit) commits.push(currentCommit);

        console.log(`Parsed ${commits.length} commits.`);
        fs.writeFileSync(outputFile, JSON.stringify(commits, null, 2));
        console.log(`Saved commits → ${outputFile}`);

        // ── Dependency pass ──────────────────────────────────────────────────
        // Build the set of live files at HEAD (track adds/deletes)
        const liveSet = new Set<string>();
        for (const commit of commits) {
            for (const file of commit.files) {
                if (file.status === 'D') liveSet.delete(file.path);
                else liveSet.add(file.path);
            }
        }
        const liveFiles = Array.from(liveSet);

        const deps = await parseDeps(liveFiles);
        const depCount = Object.keys(deps).length;
        fs.writeFileSync(depsFile, JSON.stringify(deps, null, 2));
        console.log(`Saved deps (${depCount} files with imports) → ${depsFile}`);

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
