const fs = require('fs');
const path = require('path');
const { buildUnresolvedCatalog } = require('../src/tests/review/unresolvedEffectCatalog');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const baseDir = process.cwd();
  const outDir = path.join(baseDir, 'requirement', 'review');
  ensureDir(outDir);

  const catalog = buildUnresolvedCatalog(baseDir);
  const catalogPath = path.join(outDir, 'unresolved_effect_catalog.json');
  const mappingPath = path.join(outDir, 'unresolved_effect_mapping.json');

  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  const mapping = catalog.entries.map((entry) => ({
    issueId: entry.issueId,
    file: entry.file,
    cardId: entry.cardId,
    effectId: entry.effectId,
    ownerModule: entry.ownerModule,
    featureFamily: entry.featureFamily,
    reason: entry.reason
  }));
  fs.writeFileSync(mappingPath, `${JSON.stringify({ generatedAt: catalog.generatedAt, total: mapping.length, mapping }, null, 2)}\n`, 'utf8');

  console.log(`Generated: ${catalogPath}`);
  console.log(`Generated: ${mappingPath}`);
  console.log(`Unresolved entries: ${catalog.total}`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
