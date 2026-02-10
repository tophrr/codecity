
import { simpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const git = simpleGit();
const outputDir = path.resolve(__dirname, '../src/data');
const outputFile = path.join(outputDir, 'commits.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function run() {
    console.log('Parsing Git log...');
    try {
        // We use --numstat to get insertions and deletions per file
        // We also want no merges to keep the history linear-ish for the MVP city
        // simple-git's log parser handles --numstat and puts it in `diff`
        const log = await git.log([
            '--numstat',
            '--no-merges',
            '--date=iso'
        ]);

        const commits = log.all.map((commit) => {
            // commit.diff is present when --numstat or --stat is used
            // It is an object? No, in simple-git it might be attached differently depending on version
            // Let's debug if needed, but standard usage suggests it parses it.
            // However, simple-git types say `diff` property exists on `LogResult`? 
            // Actually, looking at docs, `diff` is NOT on `ListLogLine` by default.
            // If we use `git.log`, we might get a `ListLogSummary` which has `all` array.

            // If simple-git doesn't parse numstat automatically into the objects in `all`, 
            // we might need to rely on the `diff` property of the `LogResult` which might aggregate it?
            // No, usually it attaches `diff` to the commit object if it can parse it.

            // Let's assume for a moment we might need to perform a raw parse if this doesn't work.
            // But let's try to map what we expect.

            return {
                hash: commit.hash,
                date: commit.date,
                message: commit.message,
                author_name: commit.author_name,
                author_email: commit.author_email,
                files: commit.diff ? commit.diff.files : []
            };
        });

        console.log(`Parsed ${commits.length} commits.`);
        if (commits.length > 0) {
            console.log('Sample commit:', JSON.stringify(commits[0], null, 2));
        }

        fs.writeFileSync(outputFile, JSON.stringify(commits, null, 2));
        console.log(`Saved to ${outputFile}`);

    } catch (e) {
        console.error('Error parsing git log:', e);
    }
}

run();
