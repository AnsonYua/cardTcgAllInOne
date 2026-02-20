const fs = require('fs');
const path = require('path');

require('ts-node/register/transpile-only');
const {
  CANONICAL_TARGET_FILTER_KEYS,
  normalizeConditionTypeAlias,
  normalizeSelectionTypeAlias
} = require('../../services/effects/schema/EffectSchema.ts');

const DEFAULT_CARD_FILES = [
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
  'st08Card.json'
];

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (!value || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDescription(description) {
  if (Array.isArray(description)) {
    return normalizeText(description.join(' '));
  }
  return normalizeText(description);
}

function normalizeWindows(rule) {
  return Array.isArray(rule?.timing?.windows)
    ? rule.timing.windows.map((window) => String(window).toUpperCase()).sort()
    : [];
}

function windowsOverlap(a, b) {
  if (a.length === 0 || b.length === 0) {
    return true;
  }
  const index = new Set(a);
  return b.some((entry) => index.has(entry));
}

function collectConditionTypes(conditions, target = []) {
  if (!Array.isArray(conditions)) {
    return target;
  }
  for (const condition of conditions) {
    if (typeof condition === 'string') {
      target.push(condition);
      continue;
    }
    if (condition && typeof condition === 'object') {
      const type = typeof condition.type === 'string' ? condition.type : '';
      if (type) {
        target.push(type);
      }
    }
  }
  return target;
}

function collectSequenceFeatures(steps, collector) {
  if (!Array.isArray(steps)) {
    return;
  }
  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      continue;
    }
    const action = typeof step.action === 'string' ? step.action : '';
    if (action) {
      collector.sequenceActions.push(action);
      if (action === 'conditional') {
        collector.hasConditional = true;
      }
    }
    if (Array.isArray(step?.parameters?.if)) {
      collectConditionTypes(step.parameters.if, collector.conditionTypes);
      collector.hasConditional = true;
    }
    if (Array.isArray(step?.parameters?.then)) {
      collectSequenceFeatures(step.parameters.then, collector);
    }
    if (Array.isArray(step?.parameters?.else)) {
      collectSequenceFeatures(step.parameters.else, collector);
    }
    if (Array.isArray(step?.parameters?.steps)) {
      collectSequenceFeatures(step.parameters.steps, collector);
    }
  }
}

function extractRuleFeatures(rule) {
  const conditionTypes = collectConditionTypes(rule?.conditions, []);
  const sourceConditionTypes = collectConditionTypes(rule?.sourceConditions, []);
  const collector = {
    sequenceActions: [],
    conditionTypes,
    hasConditional: false
  };
  collectSequenceFeatures(rule?.parameters?.steps, collector);

  if (Array.isArray(rule?.parameters?.if)) {
    collectConditionTypes(rule.parameters.if, collector.conditionTypes);
    collector.hasConditional = true;
  }

  const targetFilters = rule?.target?.filters && typeof rule.target.filters === 'object'
    ? rule.target.filters
    : {};
  const targetFilterKeys = Object.keys(targetFilters).sort();

  const action = typeof rule?.action === 'string' ? rule.action : '';
  const trigger = typeof rule?.trigger === 'string' ? rule.trigger : '';
  const effectType = typeof rule?.type === 'string' ? rule.type : '';
  const targetType = typeof rule?.target?.type === 'string' ? rule.target.type : '';
  const targetScope = typeof rule?.target?.scope === 'string' ? rule.target.scope : '';
  const targetCount = rule?.target?.count;
  const timingDuration = typeof rule?.timing?.duration === 'string' ? rule.timing.duration : '';
  const windows = normalizeWindows(rule);

  const behaviorCore = {
    action,
    effectType,
    targetType,
    targetScope,
    targetCount: targetCount === undefined ? null : targetCount,
    sequenceActions: collector.sequenceActions,
    conditionTypes: [...new Set(collector.conditionTypes)].sort(),
    sourceConditionTypes: [...new Set(sourceConditionTypes)].sort()
  };

  const schemaVariant = {
    ...behaviorCore,
    trigger,
    windows,
    timingDuration,
    targetFilters
  };

  return {
    behaviorCoreKey: stableStringify(behaviorCore),
    schemaVariantKey: stableStringify(schemaVariant),
    sequenceShapeKey: stableStringify({
      action,
      sequenceActions: collector.sequenceActions,
      hasConditional: collector.hasConditional
    }),
    hasConditional: collector.hasConditional,
    conditionTypes: [...new Set(collector.conditionTypes)].sort(),
    sourceConditionTypes: [...new Set(sourceConditionTypes)].sort(),
    targetFilterKeys,
    windows,
    trigger,
    action,
    effectType,
    targetType,
    targetScope,
    targetCount: targetCount === undefined ? null : targetCount,
    targetFilters
  };
}

function buildInventory(baseDir, cardFiles = DEFAULT_CARD_FILES) {
  const inventory = [];

  for (const file of cardFiles) {
    const filePath = path.join(baseDir, 'src', 'data', file);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const cards = json.cards || {};

    for (const [cardId, card] of Object.entries(cards)) {
      const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
      for (let index = 0; index < rules.length; index += 1) {
        const rule = rules[index];
        const features = extractRuleFeatures(rule);
        inventory.push({
          file,
          cardId,
          cardName: card?.name || '',
          cardType: card?.cardType || '',
          ruleIndex: index,
          rulePath: `cards.${cardId}.effects.rules[${index}]`,
          effectId: typeof rule?.effectId === 'string' ? rule.effectId : '',
          description: normalizeDescription(card?.effects?.description),
          rawRule: rule,
          ...features
        });
      }
    }
  }

  return inventory;
}

function clusterInventory(inventory) {
  const clusters = new Map();
  for (const row of inventory) {
    if (!clusters.has(row.behaviorCoreKey)) {
      clusters.set(row.behaviorCoreKey, []);
    }
    clusters.get(row.behaviorCoreKey).push(row);
  }

  return [...clusters.entries()].map(([coreKey, members], index) => {
    const variants = new Map();
    for (const member of members) {
      variants.set(member.schemaVariantKey, (variants.get(member.schemaVariantKey) || 0) + 1);
    }
    const sortedVariants = [...variants.entries()].sort((a, b) => b[1] - a[1]);
    return {
      clusterId: `cluster_${index + 1}`,
      coreKey,
      memberCount: members.length,
      variantCount: variants.size,
      canonicalVariantKey: sortedVariants.length > 0 ? sortedVariants[0][0] : '',
      members
    };
  });
}

function issueFactory(data) {
  return {
    issueId: data.issueId,
    severity: data.severity,
    confidence: data.confidence,
    category: data.category,
    cardId: data.cardId,
    file: data.file,
    rulePath: data.rulePath,
    currentSchema: data.currentSchema,
    expectedCanonicalSchema: data.expectedCanonicalSchema,
    behavioralRisk: data.behavioralRisk,
    recommendedFix: data.recommendedFix
  };
}

function detectDuplicateOverlap(inventory) {
  const issues = [];
  const byCard = new Map();
  for (const row of inventory) {
    if (!byCard.has(`${row.file}:${row.cardId}`)) {
      byCard.set(`${row.file}:${row.cardId}`, []);
    }
    byCard.get(`${row.file}:${row.cardId}`).push(row);
  }

  for (const [, rows] of byCard.entries()) {
    const commandPlayRows = rows.filter((row) => row.cardType === 'command' && row.effectType === 'play');
    for (let i = 0; i < commandPlayRows.length; i += 1) {
      for (let j = i + 1; j < commandPlayRows.length; j += 1) {
        const left = commandPlayRows[i];
        const right = commandPlayRows[j];
        if (!windowsOverlap(left.windows, right.windows)) {
          continue;
        }
        if (left.sequenceShapeKey !== right.sequenceShapeKey || left.action !== right.action) {
          continue;
        }

        issues.push(issueFactory({
          issueId: `duplicate_overlap_${left.file}_${left.cardId}_${left.ruleIndex}_${right.ruleIndex}`,
          severity: 'P1',
          confidence: 0.98,
          category: 'duplicate-overlap',
          cardId: left.cardId,
          file: left.file,
          rulePath: `${left.rulePath} <-> ${right.rulePath}`,
          currentSchema: {
            left: left.rawRule,
            right: right.rawRule
          },
          expectedCanonicalSchema: {
            keepOneRuleWithWindows: [...new Set([...left.windows, ...right.windows])].sort()
          },
          behavioralRisk: 'Effect can resolve more than once in the same timing window.',
          recommendedFix: 'Remove duplicate overlapping play rule and keep one canonical rule definition.'
        }));
      }
    }
  }

  return issues;
}

function detectMissingCondition(inventory) {
  const issues = [];
  const byCard = new Map();
  for (const row of inventory) {
    if (!byCard.has(`${row.file}:${row.cardId}`)) {
      byCard.set(`${row.file}:${row.cardId}`, []);
    }
    byCard.get(`${row.file}:${row.cardId}`).push(row);
  }

  for (const [, rows] of byCard.entries()) {
    if (rows.length === 0) {
      continue;
    }
    const description = rows[0].description;
    const looksConditional = /\bif\b/.test(description);
    const referencesTrashCount = /in your trash|in their card name/.test(description);
    if (!looksConditional || !referencesTrashCount) {
      continue;
    }

    const hasConditionalStructure = rows.some((row) => row.hasConditional || row.conditionTypes.length > 0);
    if (hasConditionalStructure) {
      continue;
    }

    const lead = rows[0];
    issues.push(issueFactory({
      issueId: `missing_condition_${lead.file}_${lead.cardId}`,
      severity: 'P1',
      confidence: 0.86,
      category: 'missing-condition',
      cardId: lead.cardId,
      file: lead.file,
      rulePath: rows.map((row) => row.rulePath).join(', '),
      currentSchema: rows.map((row) => row.rawRule),
      expectedCanonicalSchema: {
        shouldContainConditional: true,
        suggestedConditionType: /card name/.test(description) ? 'cardsInTrashWithNameIncludes' : 'cardsInTrash'
      },
      behavioralRisk: 'Text-declared conditional effect is not represented in executable schema.',
      recommendedFix: 'Model the text-declared IF branch using canonical condition objects and sequence conditional steps.'
    }));
  }

  return issues;
}

function detectBranchIncomplete(inventory) {
  const issues = [];
  for (const row of inventory) {
    const steps = Array.isArray(row.rawRule?.parameters?.steps) ? row.rawRule.parameters.steps : [];
    for (let idx = 0; idx < steps.length; idx += 1) {
      const step = steps[idx];
      if (step?.action !== 'conditional') {
        continue;
      }
      const ifConds = Array.isArray(step?.parameters?.if) ? step.parameters.if : [];
      const thenSteps = Array.isArray(step?.parameters?.then) ? step.parameters.then : [];
      const elseSteps = Array.isArray(step?.parameters?.else) ? step.parameters.else : [];
      if (ifConds.length === 0) {
        continue;
      }
      if (thenSteps.length === 0 || (/\binstead\b/.test(row.description) && elseSteps.length === 0)) {
        issues.push(issueFactory({
          issueId: `branch_incomplete_${row.file}_${row.cardId}_${row.ruleIndex}_${idx}`,
          severity: 'P1',
          confidence: 0.8,
          category: 'branch-incomplete',
          cardId: row.cardId,
          file: row.file,
          rulePath: `${row.rulePath}.parameters.steps[${idx}]`,
          currentSchema: step,
          expectedCanonicalSchema: {
            conditional: {
              requiresThen: true,
              requiresElseWhenTextHasInstead: /\binstead\b/.test(row.description)
            }
          },
          behavioralRisk: 'Conditional step can silently skip intended branch behavior.',
          recommendedFix: 'Provide complete then/else branches matching described behavior.'
        }));
      }
    }
  }
  return issues;
}

function detectDrift(clusters) {
  const issues = [];
  for (const cluster of clusters) {
    if (cluster.memberCount < 2 || cluster.variantCount < 2) {
      continue;
    }

    const canonical = cluster.members.find((member) => member.schemaVariantKey === cluster.canonicalVariantKey) || cluster.members[0];

    for (const member of cluster.members) {
      if (member.schemaVariantKey === cluster.canonicalVariantKey) {
        continue;
      }
      if (member.trigger !== canonical.trigger || stableStringify(member.windows) !== stableStringify(canonical.windows)) {
        issues.push(issueFactory({
          issueId: `trigger_window_drift_${member.file}_${member.cardId}_${member.ruleIndex}`,
          severity: 'P2',
          confidence: 0.73,
          category: 'trigger-window-drift',
          cardId: member.cardId,
          file: member.file,
          rulePath: member.rulePath,
          currentSchema: { trigger: member.trigger, windows: member.windows },
          expectedCanonicalSchema: { trigger: canonical.trigger, windows: canonical.windows },
          behavioralRisk: 'Behavior-equivalent rules execute in different phases/timings.',
          recommendedFix: 'Align trigger/timing windows with canonical family variant unless text requires divergence.'
        }));
      }

      if (stableStringify(member.targetFilters) !== stableStringify(canonical.targetFilters)) {
        issues.push(issueFactory({
          issueId: `target_constraint_drift_${member.file}_${member.cardId}_${member.ruleIndex}`,
          severity: 'P2',
          confidence: 0.76,
          category: 'target-constraint-drift',
          cardId: member.cardId,
          file: member.file,
          rulePath: member.rulePath,
          currentSchema: member.targetFilters,
          expectedCanonicalSchema: canonical.targetFilters,
          behavioralRisk: 'Equivalent behavior family has inconsistent target constraints.',
          recommendedFix: 'Align target filter constraints or explicitly document intentional difference.'
        }));
      }

      if (member.sequenceShapeKey !== canonical.sequenceShapeKey) {
        issues.push(issueFactory({
          issueId: `sequence_shape_drift_${member.file}_${member.cardId}_${member.ruleIndex}`,
          severity: 'P2',
          confidence: 0.7,
          category: 'sequence-shape-drift',
          cardId: member.cardId,
          file: member.file,
          rulePath: member.rulePath,
          currentSchema: { action: member.action, sequenceActions: member.sequenceShapeKey },
          expectedCanonicalSchema: { action: canonical.action, sequenceActions: canonical.sequenceShapeKey },
          behavioralRisk: 'Equivalent behavior can resolve in different order.',
          recommendedFix: 'Align sequence action chain with canonical variant for deterministic behavior.'
        }));
      }
    }
  }
  return issues;
}

function detectCanonicalFieldDrift(inventory) {
  const issues = [];
  for (const row of inventory) {
    const rule = row.rawRule || {};
    if (Array.isArray(rule?.conditions)) {
      for (let idx = 0; idx < rule.conditions.length; idx += 1) {
        const condition = rule.conditions[idx];
        if (!condition || typeof condition !== 'object') {
          continue;
        }
        const rawType = typeof condition.type === 'string' ? condition.type : '';
        const normalizedType = normalizeConditionTypeAlias(rawType);
        if (rawType && normalizedType !== rawType) {
          issues.push(issueFactory({
            issueId: `canonical_condition_alias_${row.file}_${row.cardId}_${row.ruleIndex}_${idx}`,
            severity: 'P3',
            confidence: 0.95,
            category: 'canonical-field-drift',
            cardId: row.cardId,
            file: row.file,
            rulePath: `${row.rulePath}.conditions[${idx}].type`,
            currentSchema: rawType,
            expectedCanonicalSchema: normalizedType,
            behavioralRisk: 'Low immediate risk, but increases schema drift and maintenance cost.',
            recommendedFix: `Use canonical condition type "${normalizedType}" instead of "${rawType}".`
          }));
        }
      }
    }

    if (rule?.target?.selection && typeof rule.target.selection === 'object') {
      const rawSelectionType = typeof rule.target.selection.type === 'string' ? rule.target.selection.type : '';
      const rawTieBreaker = typeof rule.target.selection.tieBreaker === 'string' ? rule.target.selection.tieBreaker : undefined;
      const normalizedSelection = normalizeSelectionTypeAlias(rawSelectionType, rawTieBreaker);
      if (rawSelectionType && normalizedSelection.type !== rawSelectionType) {
        issues.push(issueFactory({
          issueId: `canonical_selection_alias_${row.file}_${row.cardId}_${row.ruleIndex}`,
          severity: 'P3',
          confidence: 0.95,
          category: 'canonical-field-drift',
          cardId: row.cardId,
          file: row.file,
          rulePath: `${row.rulePath}.target.selection.type`,
          currentSchema: rawSelectionType,
          expectedCanonicalSchema: normalizedSelection.type,
          behavioralRisk: 'Low immediate risk, but increases schema drift and maintenance cost.',
          recommendedFix: `Use canonical selection type "${normalizedSelection.type}".`
        }));
      }
    }

    if (rule?.target?.filters && typeof rule.target.filters === 'object') {
      for (const filterKey of Object.keys(rule.target.filters)) {
        if (CANONICAL_TARGET_FILTER_KEYS.has(filterKey)) {
          continue;
        }
        issues.push(issueFactory({
          issueId: `unknown_target_filter_${row.file}_${row.cardId}_${row.ruleIndex}_${filterKey}`,
          severity: 'P2',
          confidence: 0.9,
          category: 'canonical-field-drift',
          cardId: row.cardId,
          file: row.file,
          rulePath: `${row.rulePath}.target.filters.${filterKey}`,
          currentSchema: filterKey,
          expectedCanonicalSchema: [...CANONICAL_TARGET_FILTER_KEYS].sort(),
          behavioralRisk: 'Unknown filter may be ignored at runtime or handled inconsistently.',
          recommendedFix: 'Replace unknown target filter with canonical equivalent or extend canonical schema intentionally.'
        }));
      }
    }
  }

  return issues;
}

function extractExcludeSourceDescriptor(row) {
  const payload = stableStringify(row.rawRule || {});
  const hasNameIncludes = payload.includes('cardsInTrashWithNameIncludes');
  const hasCardsInTrash = payload.includes('"type":"cardsInTrash"') || payload.includes('"type":"cardsInTrashWithTraitsAny"');
  if (!hasNameIncludes && !hasCardsInTrash) {
    return null;
  }
  const familyKey = hasNameIncludes
    ? `nameIncludes:${row.effectId || row.cardId}`
    : `cardsInTrash:${row.effectId || row.cardId}`;
  const hasExcludeSource = payload.includes('"excludeSourceCard":true');
  return { familyKey, hasExcludeSource };
}

function detectSourceExclusionConsistency(inventory) {
  const groups = new Map();
  for (const row of inventory) {
    const descriptor = extractExcludeSourceDescriptor(row);
    if (!descriptor) {
      continue;
    }
    if (!groups.has(descriptor.familyKey)) {
      groups.set(descriptor.familyKey, []);
    }
    groups.get(descriptor.familyKey).push({ row, hasExcludeSource: descriptor.hasExcludeSource });
  }

  const issues = [];
  for (const [familyKey, entries] of groups.entries()) {
    const includesTrue = entries.some((entry) => entry.hasExcludeSource);
    const includesFalse = entries.some((entry) => !entry.hasExcludeSource);
    if (!includesTrue || !includesFalse) {
      continue;
    }
    for (const entry of entries.filter((item) => !item.hasExcludeSource)) {
      issues.push(issueFactory({
        issueId: `source_exclusion_consistency_${entry.row.file}_${entry.row.cardId}_${entry.row.ruleIndex}`,
        severity: 'P2',
        confidence: 0.74,
        category: 'source-exclusion-consistency',
        cardId: entry.row.cardId,
        file: entry.row.file,
        rulePath: entry.row.rulePath,
        currentSchema: { excludeSourceCard: false, familyKey },
        expectedCanonicalSchema: { excludeSourceCard: true, familyKey },
        behavioralRisk: 'Similar trash-count effects may count source card inconsistently.',
        recommendedFix: 'Standardize excludeSourceCard usage within the same behavior family.'
      }));
    }
  }

  return issues;
}

function dedupeIssues(issues) {
  const seen = new Set();
  const result = [];
  for (const issue of issues) {
    if (seen.has(issue.issueId)) {
      continue;
    }
    seen.add(issue.issueId);
    result.push(issue);
  }
  return result;
}

function summarizeBy(issues, key) {
  const summary = {};
  for (const issue of issues) {
    const value = issue[key];
    summary[value] = (summary[value] || 0) + 1;
  }
  return summary;
}

function generateEffectAlignmentReport(baseDir, options = {}) {
  const files = Array.isArray(options.cardFiles) && options.cardFiles.length > 0
    ? options.cardFiles
    : DEFAULT_CARD_FILES;
  const inventory = buildInventory(baseDir, files);
  const clusters = clusterInventory(inventory);

  const issues = dedupeIssues([
    ...detectDuplicateOverlap(inventory),
    ...detectMissingCondition(inventory),
    ...detectBranchIncomplete(inventory),
    ...detectDrift(clusters),
    ...detectCanonicalFieldDrift(inventory),
    ...detectSourceExclusionConsistency(inventory)
  ]);

  const uniqueCards = new Set(inventory.map((row) => `${row.file}:${row.cardId}`));
  const report = {
    generatedAt: new Date().toISOString(),
    filesScanned: files,
    cardsScanned: uniqueCards.size,
    rulesScanned: inventory.length,
    clusters: clusters.map((cluster) => ({
      clusterId: cluster.clusterId,
      memberCount: cluster.memberCount,
      variantCount: cluster.variantCount,
      canonicalVariantKey: cluster.canonicalVariantKey,
      memberRefs: cluster.members.map((member) => ({
        file: member.file,
        cardId: member.cardId,
        cardName: member.cardName,
        rulePath: member.rulePath,
        effectId: member.effectId
      }))
    })),
    issues,
    summaryByCategory: summarizeBy(issues, 'category'),
    summaryBySeverity: summarizeBy(issues, 'severity')
  };

  return report;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Effect Alignment Review Report');
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Files scanned: ${report.filesScanned.length}`);
  lines.push(`Cards scanned: ${report.cardsScanned}`);
  lines.push(`Rules scanned: ${report.rulesScanned}`);
  lines.push(`Issues: ${report.issues.length}`);
  lines.push('');

  lines.push('## Summary by Severity');
  lines.push('');
  for (const [severity, count] of Object.entries(report.summaryBySeverity)) {
    lines.push(`- ${severity}: ${count}`);
  }
  lines.push('');

  lines.push('## Summary by Category');
  lines.push('');
  for (const [category, count] of Object.entries(report.summaryByCategory)) {
    lines.push(`- ${category}: ${count}`);
  }
  lines.push('');

  lines.push('## Top Issues');
  lines.push('');
  const prioritized = [...report.issues].sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
  });
  for (const issue of prioritized.slice(0, 120)) {
    lines.push(`### ${issue.issueId}`);
    lines.push(`- Severity: ${issue.severity}`);
    lines.push(`- Confidence: ${issue.confidence}`);
    lines.push(`- Category: ${issue.category}`);
    lines.push(`- Card: ${issue.file}:${issue.cardId}`);
    lines.push(`- Rule Path: ${issue.rulePath}`);
    lines.push(`- Behavioral Risk: ${issue.behavioralRisk}`);
    lines.push(`- Recommended Fix: ${issue.recommendedFix}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function renderFixMap(report) {
  const waves = {
    wave1: report.issues.filter((issue) => issue.severity === 'P0' || issue.severity === 'P1'),
    wave2: report.issues.filter((issue) => issue.severity === 'P2'),
    wave3: report.issues.filter((issue) => issue.severity === 'P3')
  };

  const lines = [];
  lines.push('# Effect Alignment Fix Map');
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push('');

  lines.push('## Wave 1 (Behavior-Critical)');
  lines.push('');
  lines.push(...waves.wave1.map((issue) => `- [${issue.severity}] ${issue.file}:${issue.cardId} ${issue.category} -> ${issue.recommendedFix}`));
  if (waves.wave1.length === 0) {
    lines.push('- none');
  }
  lines.push('');

  lines.push('## Wave 2 (High Regression Risk)');
  lines.push('');
  lines.push(...waves.wave2.map((issue) => `- [${issue.severity}] ${issue.file}:${issue.cardId} ${issue.category} -> ${issue.recommendedFix}`));
  if (waves.wave2.length === 0) {
    lines.push('- none');
  }
  lines.push('');

  lines.push('## Wave 3 (Canonical Cleanup)');
  lines.push('');
  lines.push(...waves.wave3.map((issue) => `- [${issue.severity}] ${issue.file}:${issue.cardId} ${issue.category} -> ${issue.recommendedFix}`));
  if (waves.wave3.length === 0) {
    lines.push('- none');
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

module.exports = {
  DEFAULT_CARD_FILES,
  stableStringify,
  normalizeDescription,
  extractRuleFeatures,
  buildInventory,
  clusterInventory,
  generateEffectAlignmentReport,
  renderMarkdown,
  renderFixMap
};
