const fs = require('fs');
const path = require('path');

const { validateEffectSchemaCanonical } = require('../src/tests/validators/effectSchemaCanonicalValidation');
const {
  generateEffectInventoryReport,
  generateAlwaysOnCompletenessReport
} = require('../src/tests/review/effectCanonicalInventory');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main() {
  const baseDir = process.cwd();
  const outDir = path.join(baseDir, 'requirement', 'review');
  ensureDir(outDir);

  validateEffectSchemaCanonical();

  const inventory = generateEffectInventoryReport(baseDir);
  const alwaysOn = generateAlwaysOnCompletenessReport(baseDir);

  const inventoryPath = path.join(outDir, 'effect_inventory_report.json');
  const alwaysOnPath = path.join(outDir, 'always_on_completeness_report.json');

  writeJson(inventoryPath, inventory);
  writeJson(alwaysOnPath, alwaysOn);

  console.log(`Generated: ${inventoryPath}`);
  console.log(`Generated: ${alwaysOnPath}`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
