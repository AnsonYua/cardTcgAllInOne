const fs = require('fs');
const path = require('path');

// Maintainer workflow (effect schema alignment):
// 1) `npm run review:effects` to generate drift reports/fix map
// 2) `npm run review:effects:apply` for supported canonicalization transforms
// 3) `npm run validate:effects:canonical` to regenerate inventory + canonical checks
// 4) `npm run validate:effects:strict` (this script) as the final gate
// If a divergence is intentional and semantics would change, add a narrowly scoped
// entry to `src/tests/review/effectCanonicalizationManifest.json` -> intentionalDivergenceAllowlist
// with file/cardId/status/reason instead of broad exceptions.

const CARD_FILES = [
  'gd01Card.json',
  'gd02Card.json',
  'gd03Card.json',
  'st01Card.json',
  'st02Card.json',
  'st03Card.json',
  'st04Card.json',
  'st05Card.json',
  'st06Card.json',
  'st07Card.json',
  'st08Card.json',
  'st09Card.json'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadAllowlist(baseDir) {
  const manifestPath = path.join(baseDir, 'src', 'tests', 'review', 'effectCanonicalizationManifest.json');
  if (!fs.existsSync(manifestPath)) {
    return [];
  }
  const manifest = readJson(manifestPath);
  const allowlist = Array.isArray(manifest.intentionalDivergenceAllowlist)
    ? manifest.intentionalDivergenceAllowlist
    : [];
  return allowlist.filter((entry) => entry && typeof entry === 'object');
}

function isAllowlisted(allowlist, file, cardId, status) {
  return allowlist.some((entry) => {
    const entryFile = typeof entry.file === 'string' ? entry.file : null;
    const entryCardId = typeof entry.cardId === 'string' ? entry.cardId : null;
    const entryStatus = typeof entry.status === 'string' ? entry.status : null;
    return entryFile === file && entryCardId === cardId && entryStatus === status;
  });
}

function collectLegacyKeywordTypeViolations(baseDir) {
  const violations = [];
  for (const fileName of CARD_FILES) {
    const filePath = path.join(baseDir, 'src', 'data', fileName);
    const json = readJson(filePath);
    const cards = json.cards || {};
    for (const [cardId, card] of Object.entries(cards)) {
      const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
      for (const rule of rules) {
        if (String(rule?.type || '').toLowerCase() === 'keyword') {
          violations.push(`${fileName}:${cardId}:${rule.effectId || 'unknown'}`);
        }
      }
    }
  }
  return violations;
}

function main() {
  const baseDir = process.cwd();
  const reviewDir = path.join(baseDir, 'requirement', 'review');
  const alwaysOnPath = path.join(reviewDir, 'always_on_completeness_report.json');
  const inventoryPath = path.join(reviewDir, 'effect_inventory_report.json');

  if (!fs.existsSync(alwaysOnPath) || !fs.existsSync(inventoryPath)) {
    throw new Error(
      'Missing canonical reports. Run `npm run validate:effects:canonical` before strict gate.'
    );
  }

  const alwaysOn = readJson(alwaysOnPath);
  const inventory = readJson(inventoryPath);
  const allowlist = loadAllowlist(baseDir);

  const violations = [];

  for (const entry of alwaysOn.entries || []) {
    const status = String(entry?.status || '');
    if (status === 'complete') {
      continue;
    }
    const file = String(entry?.file || '');
    const cardId = String(entry?.cardId || '');
    if (isAllowlisted(allowlist, file, cardId, status)) {
      continue;
    }
    violations.push(`always_on:${file}:${cardId}:${status}`);
  }

  for (const card of inventory.cards || []) {
    const status = String(card?.alwaysOnStatus || '');
    if (status === 'complete' || status === 'no-passive-text') {
      continue;
    }
    const file = String(card?.file || '');
    const cardId = String(card?.cardId || '');
    if (isAllowlisted(allowlist, file, cardId, status)) {
      continue;
    }
    violations.push(`inventory:${file}:${cardId}:${status}`);
  }

  const legacyKeywordViolations = collectLegacyKeywordTypeViolations(baseDir);
  for (const violation of legacyKeywordViolations) {
    violations.push(`legacy_keyword_type:${violation}`);
  }

  if (violations.length > 0) {
    throw new Error(`Effect canonical strict gate failed:\n${violations.join('\n')}`);
  }

  console.log('OK: effect canonical strict gate');
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
