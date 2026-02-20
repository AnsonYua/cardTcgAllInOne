const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function windowsOverlap(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return true;
  }
  const left = new Set(a.map((entry) => String(entry).toUpperCase()));
  return b.map((entry) => String(entry).toUpperCase()).some((entry) => left.has(entry));
}

function getPlayWindows(rule) {
  return Array.isArray(rule?.timing?.windows) ? rule.timing.windows : [];
}

function applyDuplicateOverlapFix(card) {
  const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : null;
  if (!rules || rules.length < 2) {
    return { changed: false, details: 'not-enough-rules' };
  }

  const kept = [];
  let removed = 0;

  for (const rule of rules) {
    if (rule?.type !== 'play') {
      kept.push(rule);
      continue;
    }

    const alreadyConflicts = kept.some((existing) => {
      if (existing?.type !== 'play') {
        return false;
      }
      if ((existing?.action || '') !== (rule?.action || '')) {
        return false;
      }
      return windowsOverlap(getPlayWindows(existing), getPlayWindows(rule));
    });

    if (alreadyConflicts) {
      removed += 1;
      continue;
    }

    kept.push(rule);
  }

  if (removed === 0) {
    return { changed: false, details: 'no-overlap-found' };
  }

  card.effects.rules = kept;
  return { changed: true, details: `removed-${removed}` };
}

function walkAndPatchExcludeSource(node) {
  let changed = 0;
  if (!node || typeof node !== 'object') {
    return changed;
  }
  if (Array.isArray(node)) {
    for (const entry of node) {
      changed += walkAndPatchExcludeSource(entry);
    }
    return changed;
  }

  const type = typeof node.type === 'string' ? node.type : '';
  if ((type === 'cardsInTrash' || type === 'cardsInTrashWithNameIncludes' || type === 'cardsInTrashWithTraitsAny') && node.excludeSourceCard !== true) {
    node.excludeSourceCard = true;
    changed += 1;
  }

  for (const value of Object.values(node)) {
    changed += walkAndPatchExcludeSource(value);
  }
  return changed;
}

function main() {
  const baseDir = process.cwd();
  const reportPath = path.join(baseDir, 'requirement', 'review', 'effect_alignment_report.json');
  const manifestPath = path.join(baseDir, 'src', 'tests', 'review', 'effectCanonicalizationManifest.json');
  const outputDir = path.join(baseDir, 'requirement', 'review');
  ensureDir(outputDir);

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing report: ${reportPath}`);
  }

  const report = readJson(reportPath);
  const manifest = fs.existsSync(manifestPath)
    ? readJson(manifestPath)
    : { canonicalizationRules: [], intentionalDivergenceAllowlist: [] };

  const issues = Array.isArray(report?.issues) ? report.issues : [];
  const fileCache = new Map();

  function loadCardFile(fileName) {
    const filePath = path.join(baseDir, 'src', 'data', fileName);
    if (!fileCache.has(fileName)) {
      fileCache.set(fileName, {
        filePath,
        json: readJson(filePath),
        dirty: false
      });
    }
    return fileCache.get(fileName);
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    reportPath,
    manifestPath,
    issuesSeen: issues.length,
    applied: [],
    skipped: []
  };

  for (const issue of issues) {
    const fileName = issue?.file;
    const cardId = issue?.cardId;
    if (typeof fileName !== 'string' || typeof cardId !== 'string') {
      audit.skipped.push({ issueId: issue?.issueId || 'unknown', reason: 'missing-card-ref' });
      continue;
    }

    const fileRecord = loadCardFile(fileName);
    const card = fileRecord?.json?.cards?.[cardId];
    if (!card) {
      audit.skipped.push({ issueId: issue.issueId, reason: 'card-not-found' });
      continue;
    }

    if (issue.category === 'duplicate-overlap') {
      const result = applyDuplicateOverlapFix(card);
      if (result.changed) {
        fileRecord.dirty = true;
        audit.applied.push({ issueId: issue.issueId, file: fileName, cardId, action: 'duplicate-overlap-fix', details: result.details });
      } else {
        audit.skipped.push({ issueId: issue.issueId, reason: result.details });
      }
      continue;
    }

    if (issue.category === 'source-exclusion-consistency') {
      const changed = walkAndPatchExcludeSource(card);
      if (changed > 0) {
        fileRecord.dirty = true;
        audit.applied.push({ issueId: issue.issueId, file: fileName, cardId, action: 'enable-exclude-source', details: `conditions-patched-${changed}` });
      } else {
        audit.skipped.push({ issueId: issue.issueId, reason: 'no-condition-to-patch' });
      }
      continue;
    }

    audit.skipped.push({ issueId: issue.issueId, reason: `unsupported-category-${issue.category}` });
  }

  for (const [fileName, record] of fileCache.entries()) {
    if (!record.dirty) {
      continue;
    }
    writeJson(record.filePath, record.json);
    audit.applied.push({ file: fileName, action: 'file-written' });
  }

  const auditPath = path.join(outputDir, 'effect_canonicalization_audit.json');
  writeJson(auditPath, {
    ...audit,
    manifestRuleCount: Array.isArray(manifest?.canonicalizationRules) ? manifest.canonicalizationRules.length : 0,
    allowlistCount: Array.isArray(manifest?.intentionalDivergenceAllowlist) ? manifest.intentionalDivergenceAllowlist.length : 0
  });

  console.log(`Applied entries: ${audit.applied.length}`);
  console.log(`Skipped entries: ${audit.skipped.length}`);
  console.log(`Audit: ${auditPath}`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
