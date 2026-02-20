const fs = require('fs');
const path = require('path');
const { buildUnresolvedCatalog } = require('../src/tests/review/unresolvedEffectCatalog');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const baseDir = process.cwd();
  const baselinePath = path.join(baseDir, 'requirement', 'review', 'unresolved_effect_baseline.json');

  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Missing baseline file: ${baselinePath}`);
  }

  const baseline = readJson(baselinePath);
  const current = buildUnresolvedCatalog(baseDir);

  const maxAllowed = typeof baseline.maxAllowed === 'number' ? baseline.maxAllowed : Number.MAX_SAFE_INTEGER;
  const requireStrictDecrease = baseline.requireStrictDecrease === true;
  const previousTotal = typeof baseline.previousTotal === 'number' ? baseline.previousTotal : maxAllowed;

  if (current.total > maxAllowed) {
    throw new Error(`Unresolved effect count ${current.total} exceeds maxAllowed ${maxAllowed}`);
  }

  if (requireStrictDecrease && current.total >= previousTotal) {
    throw new Error(`Unresolved effect count ${current.total} must be strictly lower than previousTotal ${previousTotal}`);
  }

  console.log(`Unresolved baseline check passed: current=${current.total}, maxAllowed=${maxAllowed}${requireStrictDecrease ? `, previousTotal=${previousTotal}` : ''}`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
