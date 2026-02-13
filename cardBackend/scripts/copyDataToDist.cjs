const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcDataDir = path.join(projectRoot, 'src', 'data');
const distDataDir = path.join(projectRoot, 'dist', 'data');

if (!fs.existsSync(srcDataDir)) {
    console.error(`[postbuild] Missing source data dir: ${srcDataDir}`);
    process.exit(1);
}

fs.mkdirSync(path.dirname(distDataDir), { recursive: true });
fs.cpSync(srcDataDir, distDataDir, { recursive: true, force: true });

console.log(`[postbuild] Copied data assets to: ${distDataDir}`);
