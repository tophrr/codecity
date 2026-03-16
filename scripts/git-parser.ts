
import { simpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_PATHS = process.env.REPO_PATHS ? process.env.REPO_PATHS.split(',') : [process.cwd()];

const outputDir = path.resolve(__dirname, '../src/data');
const outputFile = path.join(outputDir, 'commits.json');
const depsFile = path.join(outputDir, 'deps.json');

const BLACKLIST_EXTENSIONS = ['.d.ts', '.lock', '.json', '.md'];
const BLACKLIST_PATHS = ['node_modules/'];

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// ─── Git rename path resolver ────────────────────────────────────────────────

/**
 * Expand git's brace rename notation to just the destination path.
 *
 * Examples:
 *   "bridge/{buffer.go => core/arraybuffer.go}"  → "bridge/core/arraybuffer.go"
 *   "{cmd/typego => pkg/cli}/build.go"            → "pkg/cli/build.go"
 *   "bridge/{ => modules/net}/http.go"            → "bridge/modules/net/http.go"
 *   "bridge/{polyfills.go => polyfills/process.go}"→ "bridge/polyfills/process.go"
 *
 * Returns null if the path does not contain rename notation.
 */
function expandRenamePath(raw: string): string | null {
    const braceStart = raw.indexOf('{');
    const braceEnd   = raw.indexOf('}');
    if (braceStart === -1 || braceEnd === -1) return null;

    const inside = raw.slice(braceStart + 1, braceEnd);
    const arrowIdx = inside.indexOf('=>');
    if (arrowIdx === -1) return null;

    const prefix = raw.slice(0, braceStart);          // e.g. "bridge/"
    const suffix = raw.slice(braceEnd + 1);            // e.g. "/http.go"
    const rhs    = inside.slice(arrowIdx + 2).trim();  // e.g. "modules/net"

    // Normalise: collapse duplicate slashes, strip leading slash from result
    const joined = (prefix + rhs + suffix).replace(/\/+/g, '/').replace(/^\//, '');
    return joined;
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

async function detectGoModuleName(git: ReturnType<typeof simpleGit>): Promise<string | null> {
    try {
        const content = await git.show(['HEAD:go.mod']);
        const m = content.match(/^module\s+(\S+)/m);
        return m ? m[1] : null;
    } catch {
        return null; // no go.mod in this repo
    }
}

// ─── Dependency extraction pass ─────────────────────────────────────────────

async function parseDeps(liveFiles: string[], git: ReturnType<typeof simpleGit>): Promise<Record<string, string[]>> {
    console.log(`Parsing dependencies for ${liveFiles.length} live files...`);

    const knownPaths = new Set(liveFiles);

    // Build set of known Go directories from live .go files
    const knownGoDirs = new Set(liveFiles.filter(f => f.endsWith('.go')).map(f => path.dirname(f).replace(/\\/g, '/')));

    const goModuleName = await detectGoModuleName(git);
    if (goModuleName) console.log(`  Detected Go module: ${goModuleName}`);

    const deps: Record<string, string[]> = {};
    let processed = 0;

    for (const filePath of liveFiles) {
        const ext = filePath.split('.').pop() ?? '';
        const isTsJs = ['ts', 'tsx', 'js', 'jsx'].includes(ext);
        const isGo = ext === 'go';

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

async function runRepo(repoPath: string, repoName: string) {
    console.log(`Parsing Git log from ${repoPath}...`);
    try {
        const separator = '|||';
        const format = `COMMIT:${separator}%H${separator}%aI${separator}%an${separator}%ae${separator}%s`;

        const gitProcess = spawn('git', [
            'log',
            `--pretty=format:${format}`,
            '--numstat',
            '--summary',
            '--no-merges',
            '--reverse'
        ], { cwd: repoPath });

        const rl = readline.createInterface({
            input: gitProcess.stdout,
            crlfDelay: Infinity
        });

        const commits: any[] = [];
        let currentCommit: any = null;

        for await (const line of rl) {
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
                    const rawPath = numstatMatch[3];

                    // Expand git rename notation to destination path
                    const isRename = rawPath.includes('=>');
                    const filePath = isRename ? (expandRenamePath(rawPath) ?? rawPath) : rawPath;

                    const shouldSkip =
                        BLACKLIST_EXTENSIONS.some(ext => filePath.endsWith(ext)) ||
                        BLACKLIST_PATHS.some(p => filePath.includes(p));
                    if (shouldSkip) continue;

                    const added   = numstatMatch[1] === '-' ? 0 : parseInt(numstatMatch[1], 10);
                    const deleted = numstatMatch[2] === '-' ? 0 : parseInt(numstatMatch[2], 10);
                    // Use repoName as sub-folder for microservices support
                    currentCommit.files.push({ path: `${repoName}/${filePath}`, added, deleted, status: isRename ? 'R' : 'M' });
                    continue;
                }

                const createMatch = line.match(/\s*create mode \d+ (.+)/);
                if (createMatch) {
                    const expanded = expandRenamePath(createMatch[1]) ?? createMatch[1];
                    const fe = currentCommit.files.find((f: any) => f.path === `${repoName}/${expanded}`);
                    if (fe) fe.status = 'A';
                    continue;
                }

                const deleteMatch = line.match(/\s*delete mode \d+ (.+)/);
                if (deleteMatch) {
                    const expanded = expandRenamePath(deleteMatch[1]) ?? deleteMatch[1];
                    const fe = currentCommit.files.find((f: any) => f.path === `${repoName}/${expanded}`);
                    if (fe) fe.status = 'D';
                    continue;
                }
            }
        }
        if (currentCommit) commits.push(currentCommit);

        console.log(`Parsed ${commits.length} commits for ${repoName}.`);
        
        const gitClient = simpleGit(repoPath);

        // ── Dependency pass ──────────────────────────────────────────────────
        // Build the set of live files at HEAD (track adds/deletes)
        const liveSet = new Set<string>();
        for (const commit of commits) {
            for (const file of commit.files) {
                // To properly check HEAD, we need the raw filePath without repoName prefix temporarily
                const rawPath = file.path.replace(`${repoName}/`, '');
                if (file.status === 'D') liveSet.delete(rawPath);
                else liveSet.add(rawPath);
            }
        }
        const liveFiles = Array.from(liveSet);

        // parse deps with simple-git locally pointing at the target repo
        const repoDeps = await parseDeps(liveFiles, gitClient);
        
        // map repo deps back to namespaced deps
        const namespacedDeps: Record<string, string[]> = {};
        for(const [file, depsList] of Object.entries(repoDeps)) {
            namespacedDeps[`${repoName}/${file}`] = depsList.map(dep => `${repoName}/${dep}`);
        }

        return { commits, deps: namespacedDeps };

    } catch (e) {
        console.error(`Error parsing repo ${repoName}:`, e);
        return { commits: [], deps: {} };
    }
}

async function run() {
    console.log(`Starting multi-repo parse for paths: ${REPO_PATHS.join(', ')}`);
    
    let allCommits: any[] = [];
    let allDeps: Record<string, string[]> = {};

    for (const repoPath of REPO_PATHS) {
        const repoName = path.basename(repoPath);
        const { commits, deps } = await runRepo(repoPath, repoName);
        allCommits = allCommits.concat(commits);
        allDeps = { ...allDeps, ...deps };
    }

    // Sort all commits globally chronologically
    allCommits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`\nTotal parsed multi-repo commits: ${allCommits.length}`);

    const CHUNK_SIZE = 1000;
    if (allCommits.length <= CHUNK_SIZE) {
        fs.writeFileSync(outputFile, JSON.stringify(allCommits, null, 2));
        console.log(`Saved commits → ${outputFile}`);
    } else {
        // Write chunks to support large repositories
        let chunkIndex = 0;
        const indexMeta = [];
        for (let i = 0; i < allCommits.length; i += CHUNK_SIZE) {
            const chunk = allCommits.slice(i, i + CHUNK_SIZE);
            const chunkFile = path.join(outputDir, `commits_part${chunkIndex}.json`);
            fs.writeFileSync(chunkFile, JSON.stringify(chunk, null, 2));
            indexMeta.push({
                file: `commits_part${chunkIndex}.json`,
                startIndex: i,
                endIndex: i + chunk.length - 1,
                count: chunk.length
            });
            chunkIndex++;
        }
        // For backwards compatibility and index
        fs.writeFileSync(outputFile, JSON.stringify({ isChunked: true, chunks: indexMeta }, null, 2));
        console.log(`Saved commits in ${chunkIndex} chunks → ${outputDir}`);
    }

    const depCount = Object.keys(allDeps).length;
    fs.writeFileSync(depsFile, JSON.stringify(allDeps, null, 2));
    console.log(`Saved aggregated deps (${depCount} files with imports) → ${depsFile}`);
}

run();
