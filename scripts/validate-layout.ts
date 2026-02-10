
import { buildCityAtCommit } from '../src/utils/cityBuilder';
import { computeLayout } from '../src/utils/layout';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commitsPath = path.resolve(__dirname, '../src/data/commits.json');
const commits = JSON.parse(fs.readFileSync(commitsPath, 'utf-8'));

if (commits.length > 0) {
    const city = buildCityAtCommit(commits, commits.length - 1);
    console.log('Building layout for latest city state...');

    const layout = computeLayout(city, { width: 100, height: 100, padding: 0 });

    console.log('Layout root:',
        `x=${layout.x}, y=${layout.y}, w=${layout.width}, h=${layout.height}`
    );

    // Check children
    if (layout.children && layout.children.length > 0) {
        console.log('First level children:');
        layout.children.forEach(c => {
            console.log(`  ${c.name}: x=${c.x}, y=${c.y}, w=${c.width}, h=${c.height}, value=${c.size}`);
        });
    }
}
