const fs = require('fs');
const path = require('path');

const ST_CARD_FILES = [
  'st01Card.json',
  'st02Card.json',
  'st03Card.json',
  'st04Card.json',
  'st05Card.json',
  'st06Card.json',
  'st07Card.json',
  'st08Card.json'
];

const CHOICE_SELECTION_TYPES = new Set(['player_choice', 'highest_level', 'lowest_hp', 'just_linked']);
const PLACEHOLDER_NOTE_PATTERNS = [/not yet implemented/i, /not enforced/i, /\bTODO\b/i, /placeholder/i];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalize(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function extractCaseLabels(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const content = fs.readFileSync(filePath, 'utf8');
  const labels = new Set();
  const regex = /case\s+'([^']+)'/g;
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    labels.add(match[1]);
  }
  return labels;
}

function extractMappedActionKeys(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  const regex = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"([A-Z_]+)"/g;
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

function extractRouterActions(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const content = fs.readFileSync(filePath, 'utf8');
  const actions = new Set();
  const regex = /effectAction\s*===\s*'([^']+)'/g;
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    actions.add(match[1]);
  }
  return actions;
}

function extractExecutorActions(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const content = fs.readFileSync(filePath, 'utf8');
  const actions = new Set();
  const start = content.indexOf('ACTION_HANDLERS');
  if (start < 0) return actions;
  const body = content.slice(start, start + 12000);
  const regex = /\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\(\{/g;
  let match = null;
  while ((match = regex.exec(body)) !== null) {
    actions.add(match[1]);
  }
  return actions;
}

function collectConditionCoverage(baseDir) {
  const conditionFiles = [
    'src/services/conditions/EffectConditionEvaluator.ts',
    'src/services/conditions/SourceAndSpecialConditionEvaluator.ts',
    'src/services/conditions/ConditionEvaluators.ts',
    'src/services/conditions/PairingConditionEvaluator.ts',
    'src/services/conditions/EventConditionEvaluator.ts',
    'src/services/conditions/EffectSourceConditionEvaluator.ts'
  ];

  const set = new Set();
  for (const rel of conditionFiles) {
    const labels = extractCaseLabels(path.join(baseDir, rel));
    for (const label of labels) {
      set.add(label);
    }
  }
  set.add('traitMatch');
  set.add('cardTypeMatch');
  set.add('powerThreshold');
  return set;
}

function collectBackendActionCoverage(baseDir) {
  const executorActions = extractExecutorActions(path.join(baseDir, 'src/services/effects/EffectExecutor.ts'));
  const routerActions = extractRouterActions(path.join(baseDir, 'src/services/effects/EffectActionRouter.ts'));
  const specialActions = new Set([
    'activate_ability',
    'designate_pilot',
    'heal',
    'modifyAP',
    'modifyHP',
    'modifyCost',
    'modifyLevel',
    'redirect_attack',
    'draw_if_moved_cards_match_traits',
    'moveTopDeckToTrash'
  ]);

  return new Set([...executorActions, ...routerActions, ...specialActions]);
}

function collectFrontendActionCoverage(frontendDir) {
  const targetChoiceActionKinds = path.join(frontendDir, 'src/phaser/controllers/targeting/TargetChoiceActionKinds.ts');
  return extractMappedActionKeys(targetChoiceActionKinds);
}

function collectRows(baseDir) {
  const rows = [];
  for (const file of ST_CARD_FILES) {
    const dataPath = path.join(baseDir, 'src', 'data', file);
    const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const cards = json.cards || {};
    for (const [cardId, card] of Object.entries(cards)) {
      const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
      const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
      for (let index = 0; index < rules.length; index += 1) {
        const rule = rules[index];
        const description = typeof descriptions[index] === 'string' ? descriptions[index] : '';
        rows.push({
          file,
          cardId,
          cardName: card?.name || '',
          ruleIndex: index,
          effectId: normalize(rule?.effectId),
          trigger: normalize(rule?.trigger),
          action: normalize(rule?.action),
          type: normalize(rule?.type),
          description,
          hasMappedDescription: description.trim().length > 0,
          descriptionCount: descriptions.length,
          ruleCount: rules.length,
          target: rule?.target || null,
          conditions: Array.isArray(rule?.conditions) ? rule.conditions : [],
          sourceConditions: Array.isArray(rule?.sourceConditions) ? rule.sourceConditions : [],
          timing: rule?.timing || {},
          parameters: rule?.parameters || {}
        });
      }
    }
  }
  return rows;
}

function evaluateRow(row, coverage) {
  const findings = [];
  const severityOrder = { FAIL: 2, WARN: 1, PASS: 0 };
  let status = 'PASS';

  const descriptionLower = normalizeLower(row.description);
  const selectionType = normalizeLower(row?.target?.selection?.type);
  const tieBreaker = normalizeLower(row?.target?.selection?.tieBreaker);
  const requiresChoice = CHOICE_SELECTION_TYPES.has(selectionType) || tieBreaker === 'controller_choice';

  if (row.descriptionCount !== row.ruleCount) {
    const mismatchKind = row.hasMappedDescription ? 'shared-description-format' : 'missing-description-index';
    findings.push({
      level: 'WARN',
      code: mismatchKind,
      message: `description count (${row.descriptionCount}) differs from rules (${row.ruleCount})`
    });
  }

  if (!row.hasMappedDescription && requiresChoice) {
    findings.push({
      level: 'WARN',
      code: 'choice-text-fallback',
      message: 'choice effect has no direct description index; frontend fallback path required'
    });
  }

  const otherText = descriptionLower.includes(' other ');
  const scope = normalizeLower(row?.target?.scope);
  const count = Number(row?.target?.count ?? 1);
  const excludeSource = row?.parameters?.excludeSource === true;
  const excludeSelf = row?.target?.filters?.excludeSelf === true;
  if (
    otherText &&
    scope.startsWith('self_all') &&
    count === 1 &&
    selectionType === 'player_choice' &&
    !excludeSource &&
    !excludeSelf
  ) {
    findings.push({
      level: 'FAIL',
      code: 'other-target-not-enforced',
      message: 'description says "other" but rule does not exclude source'
    });
  }

  const noteText = normalize(row?.parameters?.notes);
  if (noteText && PLACEHOLDER_NOTE_PATTERNS.some((pattern) => pattern.test(noteText))) {
    findings.push({
      level: 'FAIL',
      code: 'stale-implementation-note',
      message: noteText
    });
  }

  if (row.action && !coverage.backendActions.has(row.action)) {
    findings.push({
      level: 'FAIL',
      code: 'backend-action-uncovered',
      message: `action "${row.action}" not found in backend effect action paths`
    });
  }

  if (row.trigger && !coverage.backendTriggers.has(row.trigger)) {
    findings.push({
      level: 'FAIL',
      code: 'backend-trigger-uncovered',
      message: `trigger "${row.trigger}" not in backend trigger coverage set`
    });
  }

  const allConditions = [...row.conditions, ...row.sourceConditions];
  for (const condition of allConditions) {
    if (!condition || typeof condition !== 'object') continue;
    const type = normalize(condition.type);
    if (!type) continue;
    if (!coverage.backendConditions.has(type)) {
      findings.push({
        level: 'FAIL',
        code: 'backend-condition-uncovered',
        message: `condition "${type}" not found in condition evaluators`
      });
    }
  }

  if (requiresChoice && row.action && !coverage.frontendChoiceActions.has(row.action)) {
    findings.push({
      level: 'WARN',
      code: 'frontend-choice-title-fallback',
      message: `action "${row.action}" is not explicitly mapped in frontend action-kind titles`
    });
  }

  for (const finding of findings) {
    if (severityOrder[finding.level] > severityOrder[status]) {
      status = finding.level;
    }
  }

  return {
    ...row,
    status,
    requiresChoice,
    findings
  };
}

function buildReport(baseDir, frontendDir) {
  const backendActions = collectBackendActionCoverage(baseDir);
  const backendConditions = collectConditionCoverage(baseDir);
  const frontendChoiceActions = collectFrontendActionCoverage(frontendDir);

  const backendTriggers = new Set([
    'ATTACK_PHASE',
    'ATTACK_REDIRECT',
    'BATTLE_DESTROY',
    'BURST_CONDITION',
    'DEFENSE_AREA_BATTLE_DAMAGE',
    'DESTROYED',
    'EFFECT_DRAW',
    'END_OF_TURN',
    'ENTERS_PLAY',
    'PAIRING_COMPLETE',
    'continuous'
  ]);

  const coverage = {
    backendActions,
    backendConditions,
    backendTriggers,
    frontendChoiceActions
  };

  const rows = collectRows(baseDir).map((row) => evaluateRow(row, coverage));
  const summary = {
    totalRows: rows.length,
    pass: rows.filter((row) => row.status === 'PASS').length,
    warn: rows.filter((row) => row.status === 'WARN').length,
    fail: rows.filter((row) => row.status === 'FAIL').length
  };

  const byCard = {};
  for (const row of rows) {
    const key = `${row.file}:${row.cardId}`;
    if (!byCard[key]) {
      byCard[key] = {
        file: row.file,
        cardId: row.cardId,
        cardName: row.cardName,
        statuses: new Set(),
        findings: []
      };
    }
    byCard[key].statuses.add(row.status);
    for (const finding of row.findings) {
      byCard[key].findings.push({ ...finding, ruleIndex: row.ruleIndex, effectId: row.effectId });
    }
  }

  const cardSummary = Object.values(byCard).map((entry) => ({
    file: entry.file,
    cardId: entry.cardId,
    cardName: entry.cardName,
    status: entry.statuses.has('FAIL') ? 'FAIL' : entry.statuses.has('WARN') ? 'WARN' : 'PASS',
    findingCount: entry.findings.length,
    findings: entry.findings
  }));

  return {
    generatedAt: new Date().toISOString(),
    files: ST_CARD_FILES,
    frontendDir,
    summary,
    cardSummary,
    rows
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# ST01-ST08 Effect Audit Report');
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Rows: ${report.summary.totalRows} | PASS: ${report.summary.pass} | WARN: ${report.summary.warn} | FAIL: ${report.summary.fail}`);
  lines.push('');
  lines.push('## Card Summary');
  lines.push('');
  lines.push('| File | Card | Name | Status | Findings |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const card of report.cardSummary.sort((a, b) => `${a.file}:${a.cardId}`.localeCompare(`${b.file}:${b.cardId}`))) {
    lines.push(`| ${card.file} | ${card.cardId} | ${card.cardName.replace(/\|/g, '\\|')} | ${card.status} | ${card.findingCount} |`);
  }
  lines.push('');
  lines.push('## Full Matrix');
  lines.push('');
  lines.push('| File | Card | Rule | Effect ID | Trigger | Action | Status | Description Mapped | Requires Choice | Findings |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of report.rows.sort((a, b) => `${a.file}:${a.cardId}:${a.ruleIndex}`.localeCompare(`${b.file}:${b.cardId}:${b.ruleIndex}`))) {
    const findingText = row.findings.map((finding) => `${finding.level}:${finding.code}`).join(', ');
    lines.push(
      `| ${row.file} | ${row.cardId} | ${row.ruleIndex} | ${row.effectId || '-'} | ${row.trigger || '-'} | ${row.action || '-'} | ${row.status} | ${row.hasMappedDescription ? 'yes' : 'no'} | ${row.requiresChoice ? 'yes' : 'no'} | ${findingText || '-'} |`
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const baseDir = process.cwd();
  const frontendDir = process.env.CARD_FRONTEND_PATH || '/Users/hello/Desktop/card/unity/cardGameFrontend';
  const report = buildReport(baseDir, frontendDir);

  const outDir = path.join(baseDir, 'requirement', 'review');
  ensureDir(outDir);

  const jsonPath = path.join(outDir, 'st_effect_audit_report.json');
  const mdPath = path.join(outDir, 'st_effect_audit_report.md');

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');

  console.log(`Generated: ${jsonPath}`);
  console.log(`Generated: ${mdPath}`);
  console.log(`Summary: PASS=${report.summary.pass} WARN=${report.summary.warn} FAIL=${report.summary.fail}`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
