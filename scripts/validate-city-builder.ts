
import { buildCityAtCommit } from '../src/utils/cityBuilder';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commitsPath = path.resolve(__dirname, '../src/data/commits.json');
const commits = JSON.parse(fs.readFileSync(commitsPath, 'utf-8'));

console.log(`Loaded ${commits.length} commits.`);

// Test 1: Build at commit 1 (Added file to delete)
// Commit 0: Initial
// Commit 1: Add delete_me.txt
// Commit 2: Delete delete_me.txt

if (commits.length >= 3) {
    const cityAt1 = buildCityAtCommit(commits, 1);
    console.log('City at commit 1 (should have delete_me.txt):');
    printTree(cityAt1);

    const cityAt2 = buildCityAtCommit(commits, 2);
    console.log('\nCity at commit 2 (should NOT have delete_me.txt):');
    printTree(cityAt2);
} else {
    console.log('Not enough commits to test deletion logic fully. Printing latest city:');
    const city = buildCityAtCommit(commits, commits.length - 1);
    printTree(city);
}

function printTree(node: any, indent = '') {
    console.log(`${indent}${node.name} (${node.type}, size: ${node.size})`);
    if (node.children) {
        node.children.forEach((c: any) => printTree(c, indent + '  '));
    }
}
