
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
        const separator = '|||';
        // Format: COMMIT:hash|||date|||author|||email|||message
        const format = `COMMIT:${separator}%H${separator}%aI${separator}%an${separator}%ae${separator}%s`;

        const logOutput = await git.raw([
            'log',
            `--pretty=format:${format}`,
            '--numstat',
            '--summary',
            '--no-merges',
            '--reverse' // Verify current order preference. Desired: Chronological for building city
        ]);

        const commits = [];
        let currentCommit = null;

        const lines = logOutput.split('\n');

        for (const line of lines) {
            if (line.trim() === '') continue;

            if (line.startsWith(`COMMIT:${separator}`)) {
                if (currentCommit) {
                    commits.push(currentCommit);
                }
                const parts = line.split(separator);
                currentCommit = {
                    hash: parts[1],
                    date: parts[2],
                    author_name: parts[3],
                    author_email: parts[4],
                    message: parts[5],
                    files: []
                };
            } else if (currentCommit) {
                // Parse numstat: "added deleted path"
                // e.g. "10  5   src/App.tsx"
                const numstatMatch = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);

                if (numstatMatch) {
                    const addedStr = numstatMatch[1];
                    const deletedStr = numstatMatch[2];
                    const filePath = numstatMatch[3];

                    const added = addedStr === '-' ? 0 : parseInt(addedStr, 10);
                    const deleted = deletedStr === '-' ? 0 : parseInt(deletedStr, 10);

                    // default status 'M' for modified
                    currentCommit.files.push({
                        path: filePath,
                        added,
                        deleted,
                        status: 'M'
                    });
                    continue;
                }

                // Parse summary: " create mode 100644 path"
                const createMatch = line.match(/\s*create mode \d+ (.+)/);
                if (createMatch) {
                    const filePath = createMatch[1];
                    const fileEntry = currentCommit.files.find(f => f.path === filePath);
                    if (fileEntry) fileEntry.status = 'A';
                    continue;
                }

                // Parse summary: " delete mode 100644 path"
                const deleteMatch = line.match(/\s*delete mode \d+ (.+)/);
                if (deleteMatch) {
                    const filePath = deleteMatch[1];
                    const fileEntry = currentCommit.files.find(f => f.path === filePath);
                    if (fileEntry) fileEntry.status = 'D';
                    continue;
                }

                // Parse summary: " rename ..." (Not handling for MVP simplicity unless critical)
            }
        }
        // Push last commit
        if (currentCommit) {
            commits.push(currentCommit);
        }

        console.log(`Parsed ${commits.length} commits.`);
        fs.writeFileSync(outputFile, JSON.stringify(commits, null, 2));
        console.log(`Saved to ${outputFile}`);

    } catch (e) {
        console.error('Error parsing git log:', e);
    }
}

run();
