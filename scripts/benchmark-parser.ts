import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, execSync } from 'child_process';
import { runRepo } from './git-parser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.resolve(__dirname, '../.benchmark_repos');

const REPOS_TO_TEST = [
    { url: 'https://github.com/expressjs/express.git', name: 'express' }, // Small/Medium JS
    { url: 'https://github.com/axios/axios.git', name: 'axios' },         // Small JS
    { url: 'https://github.com/facebook/react.git', name: 'react' },      // Large JS/TS
    { url: 'https://github.com/vuejs/core.git', name: 'vue' },            // Medium JS/TS
    { url: 'https://github.com/gin-gonic/gin.git', name: 'gin' },         // Small/Medium Go
    { url: 'https://github.com/gohugoio/hugo.git', name: 'hugo' },        // Large Go
];

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

async function cloneRepoIfMissing(repoUrl: string, repoName: string): Promise<string> {
    const targetPath = path.join(tempDir, repoName);
    if (!fs.existsSync(targetPath)) {
        console.log(`Cloning ${repoName}...`);
        execSync(`git clone --depth 1000 ${repoUrl} ${targetPath}`, { stdio: 'inherit' });
    } else {
        console.log(`Repo ${repoName} already exists.`);
    }
    return targetPath;
}

async function benchmark() {
    const results = [];

    for (const repoInfo of REPOS_TO_TEST) {
        const repoPath = await cloneRepoIfMissing(repoInfo.url, repoInfo.name);

        console.log(`\nBenchmarking: ${repoInfo.name}`);
        
        // Force garbage collection if we run node with --expose-gc to get accurate mem reads
        if (global.gc) {
            global.gc();
        }

        const startMem = process.memoryUsage().heapUsed;
        const startTime = performance.now();

        // Run the parser against this repo
        const result = await runRepo(repoPath, repoInfo.name);
        
        const endTime = performance.now();
        const endMem = process.memoryUsage().heapUsed;

        const timeMs = endTime - startTime;
        const memDiffMb = (endMem - startMem) / 1024 / 1024;
        
        console.log(`Time: ${timeMs.toFixed(2)} ms`);
        console.log(`Memory Used: ${memDiffMb.toFixed(2)} MB`);
        console.log(`Commits parsed: ${result?.commits?.length || 0}`);
        console.log(`Dependencies parsed: ${Object.keys(result?.deps || {}).length}`);

        results.push({
            name: repoInfo.name,
            commits: result?.commits?.length || 0,
            depsCount: Object.keys(result?.deps || {}).length,
            timeMs: parseFloat(timeMs.toFixed(2)),
            memoryMb: parseFloat(memDiffMb.toFixed(2)),
        });
    }

    const outputFile = path.join(__dirname, '../tests/benchmark_results.json');
    if (!fs.existsSync(path.dirname(outputFile))) {
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    }
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${outputFile}`);
}

benchmark().catch(console.error);
