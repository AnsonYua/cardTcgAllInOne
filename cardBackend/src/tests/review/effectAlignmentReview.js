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

const DEFAULT_MANIFEST_PATH = path.join('src', 'tests', 'review', 'effectCanonicalizationManifest.json');

function loadManifest(baseDir, providedManifestPath) {
  const manifestPath = providedManifestPath
    ? path.resolve(baseDir, providedManifestPath)
    : path.resolve(baseDir, DEFAULT_MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    return {
      manifestPath,
      canonicalizationRules: [],
      intentionalDivergenceAllowlist: []
    };
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const allowlist = Array.isArray(parsed?.intentionalDivergenceAllowlist)
    ? parsed.intentionalDivergenceAllowlist
    : [];
  const canonicalizationRules = Array.isArray(parsed?.canonicalizationRules)
    ? parsed.canonicalizationRules
    : [];

  return {
    manifestPath,
    canonicalizationRules,
    intentionalDivergenceAllowlist: allowlist
  };
}

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
      if (action === 'conditionalTokenDeploy' && step?.parameters && typeof step.parameters === 'object') {
        const conditionKeys = Object.keys(step.parameters).filter((key) => key.startsWith('condition'));
        if (conditionKeys.length > 1) {
          collector.hasConditional = true;
        }
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

    if (action === 'conditional' && Array.isArray(step?.parameters?.branches)) {
      collector.hasConditional = true;
      for (const branch of step.parameters.branches) {
        if (Array.isArray(branch?.conditions)) {
          collectConditionTypes(branch.conditions, collector.conditionTypes);
        }
        if (Array.isArray(branch?.steps)) {
          collectSequenceFeatures(branch.steps, collector);
        }
      }
    }
  }
}

function extractRuleFeatures(rule) {
  const action = typeof rule?.action === 'string' ? rule.action : '';
  const conditionTypes = collectConditionTypes(rule?.conditions, []);
  const sourceConditionTypes = collectConditionTypes(rule?.sourceConditions, []);
  const collector = {
    sequenceActions: [],
    conditionTypes,
    hasConditional: false
  };
  collectSequenceFeatures(rule?.parameters?.steps, collector);

  if (action === 'conditional' && Array.isArray(rule?.parameters?.branches)) {
    collector.hasConditional = true;
    for (const branch of rule.parameters.branches) {
      if (Array.isArray(branch?.conditions)) {
        collectConditionTypes(branch.conditions, collector.conditionTypes);
      }
      if (Array.isArray(branch?.steps)) {
        collectSequenceFeatures(branch.steps, collector);
      }
    }
  }

  if (action === 'conditionalTokenDeploy' && rule?.parameters && typeof rule.parameters === 'object') {
    const conditionKeys = Object.keys(rule.parameters).filter((key) => key.startsWith('condition'));
    if (conditionKeys.length > 1) {
      collector.hasConditional = true;
    }
  }

  if (Array.isArray(rule?.parameters?.if)) {
    collectConditionTypes(rule.parameters.if, collector.conditionTypes);
    collector.hasConditional = true;
  }

  const targetFilters = rule?.target?.filters && typeof rule.target.filters === 'object'
    ? rule.target.filters
    : {};
  const targetFilterKeys = Object.keys(targetFilters).sort();

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

function normalizeDriftDescription(rawDescription) {
  return normalizeText(rawDescription)
    .replace(/[【】\[\]<>():.,'"!?/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function issueMatchesAllowlist(issue, allowlistEntry) {
  if (!allowlistEntry || typeof allowlistEntry !== 'object') {
    return false;
  }
  if (typeof allowlistEntry.issueId === 'string' && allowlistEntry.issueId === issue.issueId) {
    return true;
  }
  if (typeof allowlistEntry.category === 'string' && allowlistEntry.category !== issue.category) {
    return false;
  }
  if (typeof allowlistEntry.cardId === 'string' && allowlistEntry.cardId !== issue.cardId) {
    return false;
  }
  if (typeof allowlistEntry.file === 'string' && allowlistEntry.file !== issue.file) {
    return false;
  }
  if (typeof allowlistEntry.rulePathIncludes === 'string') {
    return typeof issue.rulePath === 'string' && issue.rulePath.includes(allowlistEntry.rulePathIncludes);
  }
  return typeof allowlistEntry.category === 'string'
    || typeof allowlistEntry.cardId === 'string'
    || typeof allowlistEntry.file === 'string';
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
      if (
        isFallbackChoiceConditional(steps, idx, ifConds, thenSteps, elseSteps)
      ) {
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

function isFallbackChoiceConditional(steps, stepIndex, ifConds, thenSteps, elseSteps) {
  if (thenSteps.length !== 0 || elseSteps.length === 0) {
    return false;
  }
  if (ifConds.length !== 1) {
    return false;
  }
  const cond = ifConds[0];
  if (!cond || typeof cond !== 'object' || cond.type !== 'stepResolved') {
    return false;
  }
  const stepId = typeof cond.stepId === 'string' ? cond.stepId : '';
  if (!stepId || stepIndex <= 0) {
    return false;
  }
  const previousStep = steps[stepIndex - 1];
  if (!previousStep || typeof previousStep !== 'object') {
    return false;
  }
  return previousStep.stepId === stepId && previousStep.optional === true;
}

function detectDrift(clusters) {
  const issues = [];
  for (const cluster of clusters) {
    if (cluster.memberCount < 2 || cluster.variantCount < 2) {
      continue;
    }

    const descriptionGroups = new Map();
    for (const member of cluster.members) {
      const descriptionKey = normalizeDriftDescription(member.description);
      if (!descriptionKey) {
        continue;
      }
      if (!descriptionGroups.has(descriptionKey)) {
        descriptionGroups.set(descriptionKey, []);
      }
      descriptionGroups.get(descriptionKey).push(member);
    }

    for (const members of descriptionGroups.values()) {
      if (members.length < 2) {
        continue;
      }
      const variantCounts = new Map();
      for (const member of members) {
        variantCounts.set(member.schemaVariantKey, (variantCounts.get(member.schemaVariantKey) || 0) + 1);
      }
      if (variantCounts.size < 2) {
        continue;
      }

      const canonicalVariantKey = [...variantCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const canonical = members.find((member) => member.schemaVariantKey === canonicalVariantKey) || members[0];
      for (const member of members) {
        if (member.schemaVariantKey === canonicalVariantKey) {
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
  const matches = [];

  function walk(node) {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      for (const entry of node) {
        walk(entry);
      }
      return;
    }

    const type = typeof node.type === 'string' ? node.type : '';
    if (type === 'cardsInTrash' || type === 'cardsInTrashWithTraitsAny' || type === 'cardsInTrashWithNameIncludes') {
      const traits = Array.isArray(node.traitsAny)
        ? node.traitsAny.filter((entry) => typeof entry === 'string').sort()
        : Array.isArray(node.traits)
          ? node.traits.filter((entry) => typeof entry === 'string').sort()
          : [];
      const familyKey = stableStringify({
        type,
        scope: typeof node.scope === 'string' ? node.scope : '',
        cardType: typeof node.cardType === 'string' ? node.cardType : '',
        name: typeof node.name === 'string' ? node.name.toLowerCase() : '',
        traits,
        value: typeof node.value === 'string' || typeof node.value === 'number' ? node.value : ''
      });
      matches.push({
        familyKey,
        hasExcludeSource: node.excludeSourceCard === true
      });
    }

    for (const value of Object.values(node)) {
      walk(value);
    }
  }

  walk(row.rawRule || {});
  return matches;
}

function detectSourceExclusionConsistency(inventory) {
  const groups = new Map();
  for (const row of inventory) {
    const descriptors = extractExcludeSourceDescriptor(row);
    if (!Array.isArray(descriptors) || descriptors.length === 0) {
      continue;
    }
    for (const descriptor of descriptors) {
      if (!groups.has(descriptor.familyKey)) {
        groups.set(descriptor.familyKey, []);
      }
      groups.get(descriptor.familyKey).push({ row, hasExcludeSource: descriptor.hasExcludeSource });
    }
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

function extractDescriptionSegments(card) {
  const description = Array.isArray(card?.effects?.description) ? card.effects.description : [];
  return description
    .filter((line) => typeof line === 'string' && line.trim().length > 0)
    .map((line, index) => {
      const tags = (line.match(/(\[[^\]]+\]|【[^】]+】)/g) || [])
        .map((tag) => tag.replace(/[\[\]【】]/g, '').trim().toLowerCase())
        .filter(Boolean);
      return { line, index, tags };
    });
}

function segmentFlags(tags) {
  const has = (needle) => tags.some((tag) => tag.includes(needle));
  return {
    burst: has('burst'),
    deploy: has('deploy'),
    main: has('main'),
    action: has('action'),
    paired: has('paired') || has('when paired') || has('during pair') || has('pair'),
    linked: has('linked') || has('when linked') || has('during link') || has('link'),
    destroyed: has('destroyed')
  };
}

function hasConditionType(rule, needle) {
  const conditions = [
    ...(Array.isArray(rule?.conditions) ? rule.conditions : []),
    ...(Array.isArray(rule?.sourceConditions) ? rule.sourceConditions : [])
  ];
  return conditions.some((condition) =>
    condition &&
    typeof condition === 'object' &&
    typeof condition.type === 'string' &&
    condition.type.toLowerCase().includes(needle)
  );
}

function matchesSegmentByTrigger(rule, flags) {
  const trigger = typeof rule?.trigger === 'string' ? rule.trigger.toUpperCase() : '';
  const effectType = typeof rule?.type === 'string' ? rule.type.toLowerCase() : '';
  const win = normalizeWindows(rule);

  if (flags.burst) {
    return trigger === 'BURST_CONDITION';
  }
  if (flags.deploy) {
    return trigger === 'ENTERS_PLAY';
  }
  if (flags.destroyed) {
    return trigger === 'DESTROYED';
  }
  if (flags.main || flags.action) {
    if (effectType !== 'play' && effectType !== 'activated') {
      return false;
    }
    const hasMain = win.includes('MAIN_PHASE');
    const hasAction = win.includes('ACTION_STEP');
    if (flags.main && flags.action) {
      return hasMain || hasAction || win.length === 0;
    }
    if (flags.main) {
      return hasMain || win.length === 0;
    }
    if (flags.action) {
      return hasAction;
    }
  }
  if (flags.linked) {
    return hasConditionType(rule, 'linked') || trigger === 'PAIRING_COMPLETE';
  }
  if (flags.paired) {
    return trigger === 'PAIRING_COMPLETE' || hasConditionType(rule, 'paired');
  }
  return true;
}

function collectSequenceSteps(rule) {
  const steps = [];
  if (Array.isArray(rule?.parameters?.steps)) {
    for (const step of rule.parameters.steps) {
      steps.push(step);
      if (step?.parameters?.then && Array.isArray(step.parameters.then)) {
        steps.push(...step.parameters.then);
      }
      if (step?.parameters?.else && Array.isArray(step.parameters.else)) {
        steps.push(...step.parameters.else);
      }
      if (step?.parameters?.branches && Array.isArray(step.parameters.branches)) {
        for (const branch of step.parameters.branches) {
          if (Array.isArray(branch?.steps)) {
            steps.push(...branch.steps);
          }
        }
      }
    }
  }
  return steps;
}

function resolveTargetCount(rawCount) {
  if (typeof rawCount === 'number') {
    return rawCount;
  }
  if (rawCount && typeof rawCount === 'object' && typeof rawCount.max === 'number') {
    return rawCount.max;
  }
  return null;
}

function detectOptionalExileIfYouDoMismatch(baseDir, files) {
  const issues = [];

  for (const file of files) {
    const filePath = path.join(baseDir, 'src', 'data', file);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const cards = json.cards || {};

    for (const [cardId, card] of Object.entries(cards)) {
      const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
      if (rules.length === 0) {
        continue;
      }

      for (const segment of extractDescriptionSegments(card)) {
        const normalizedLine = normalizeText(segment.line);
        const hasOptionalMarker = /\byou may\b/.test(normalizedLine);
        const hasTrashMarker = /from your trash/.test(normalizedLine);
        const hasExileMarker = /exile .*from the game|exile it from the game|exile them from the game/.test(normalizedLine);
        const hasIfYouDoMarker = /\bif you do\b/.test(normalizedLine);
        if (!hasOptionalMarker || !hasTrashMarker || !hasExileMarker || !hasIfYouDoMarker) {
          continue;
        }

        const flags = segmentFlags(segment.tags);
        const mappedRules = rules
          .map((rule, index) => ({ rule, index }))
          .filter(({ rule }) => matchesSegmentByTrigger(rule, flags));
        if (mappedRules.length === 0) {
          continue;
        }

        const expectedExileCountMatch = normalizedLine.match(/\bchoose\s+(\d+)\b/);
        const expectedExileCount = expectedExileCountMatch ? Number(expectedExileCountMatch[1]) : null;

        for (const { rule, index } of mappedRules) {
          const rulePath = `cards.${cardId}.effects.rules[${index}]`;
          const failures = [];
          const currentSchema = {};

          const hasRuleOptional = rule?.optional === true;
          const hasCostExile = Boolean(rule?.cost?.exileFromTrash && typeof rule.cost.exileFromTrash === 'object');
          const sequenceSteps = collectSequenceSteps(rule);
          const sequenceExileStep = sequenceSteps.find((step) => step?.action === 'exileFromTrash');
          const hasSequenceExile = Boolean(sequenceExileStep);
          const hasExileOperation = hasCostExile || hasSequenceExile;

          const hasIfYouDoDependencyViaSequence = sequenceSteps.some((step) =>
            step?.action === 'conditional' &&
            Array.isArray(step?.parameters?.if) &&
            step.parameters.if.some((cond) => cond?.type === 'stepResolved')
          );
          const hasIfYouDoDependency = hasIfYouDoDependencyViaSequence || hasCostExile;

          if (!hasRuleOptional && !hasSequenceExile) {
            failures.push('missing_optional_gating');
          }
          if (!hasExileOperation) {
            failures.push('missing_exile_from_trash_operation');
          }
          if (!hasIfYouDoDependency) {
            failures.push('missing_if_you_do_dependency');
          }

          const exileCost = hasCostExile ? rule.cost.exileFromTrash : sequenceExileStep?.target;
          if (expectedExileCount !== null) {
            const exileCount = resolveTargetCount(exileCost?.count);
            if (exileCount !== expectedExileCount) {
              failures.push('exile_count_mismatch');
            }
          }

          const ruleTarget = rule?.target;
          if (ruleTarget && typeof ruleTarget === 'object') {
            const effectTargetCount = resolveTargetCount(ruleTarget.count);
            if (expectedExileCount !== null && effectTargetCount === expectedExileCount && expectedExileCount > 1) {
              failures.push('cost_effect_target_leakage_count');
            }
            const targetScope = typeof ruleTarget.scope === 'string' ? ruleTarget.scope.toLowerCase() : '';
            const targetTraits = Array.isArray(ruleTarget?.filters?.traits)
              ? ruleTarget.filters.traits.filter((entry) => typeof entry === 'string')
              : [];
            const costTraits = Array.isArray(exileCost?.traitsAny)
              ? exileCost.traitsAny.filter((entry) => typeof entry === 'string')
              : [];
            const sharesCostTrait = targetTraits.some((trait) => costTraits.includes(trait));
            if (targetScope.startsWith('opponent') && sharesCostTrait) {
              failures.push('cost_effect_target_leakage_traits');
            }
          }

          if (failures.length > 0) {
            currentSchema.optional = rule?.optional === true;
            currentSchema.action = rule?.action;
            currentSchema.cost = rule?.cost || null;
            currentSchema.target = ruleTarget || null;
            currentSchema.hasSequenceExile = hasSequenceExile;
            currentSchema.hasIfYouDoDependencyViaSequence = hasIfYouDoDependencyViaSequence;

            issues.push(issueFactory({
              issueId: `optional_exile_if_you_do_${file}_${cardId}_${index}_${segment.index}`,
              severity: 'P1',
              confidence: 0.93,
              category: 'optional-exile-if-you-do-mismatch',
              cardId,
              file,
              rulePath,
              currentSchema,
              expectedCanonicalSchema: {
                optional: true,
                requiresExileFromTrashCostOrStep: true,
                requiresIfYouDoDependency: true,
                keepCostAndEffectTargetFieldsSeparated: true
              },
              behavioralRisk: 'Optional exile gate and downstream effect can resolve incorrectly when cost semantics are missing or leaked into target config.',
              recommendedFix: `Model "${segment.line}" with optional exile-from-trash gating (cost or sequence step), ensure If-you-do dependency, and keep effect target independent from cost count/filters.`
            }));
          }
        }
      }
    }
  }

  return issues;
}

function collectTargetDefinitions(node, targets = []) {
  if (!node || typeof node !== 'object') {
    return targets;
  }
  if (Array.isArray(node)) {
    for (const entry of node) {
      collectTargetDefinitions(entry, targets);
    }
    return targets;
  }
  if (node.target && typeof node.target === 'object') {
    targets.push(node.target);
  }
  for (const value of Object.values(node)) {
    collectTargetDefinitions(value, targets);
  }
  return targets;
}

function detectPilotLevelRuleMismatch(baseDir, files) {
  const issues = [];

  for (const file of files) {
    const filePath = path.join(baseDir, 'src', 'data', file);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const cards = json.cards || {};

    for (const [cardId, card] of Object.entries(cards)) {
      const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
      if (rules.length === 0) {
        continue;
      }

      for (const segment of extractDescriptionSegments(card)) {
        const normalizedLine = normalizeText(segment.line);
        const mentionsChoosePilot = /\bchoose\b[\s\S]*\bpilot\b/.test(normalizedLine);
        const mentionsPilotLevel = /\bpilot\b[\s\S]*\blv\.?\b[\s\S]*(or lower|or higher|<=|>=|<|>|\d)/.test(normalizedLine);
        if (!mentionsChoosePilot || !mentionsPilotLevel) {
          continue;
        }

        const mentionsPairedEnemyUnit = /\bpaired with\b[\s\S]*\benemy unit\b/.test(normalizedLine);
        const mentionsEnemyUnitLevel = /\benemy unit\b[\s\S]*\blv\.?\b/.test(normalizedLine);
        const flags = segmentFlags(segment.tags);
        const mappedRules = rules
          .map((rule, index) => ({ rule, index }))
          .filter(({ rule }) => matchesSegmentByTrigger(rule, flags));
        if (mappedRules.length === 0) {
          continue;
        }

        for (const { rule, index } of mappedRules) {
          const allTargets = collectTargetDefinitions(rule, []);
          const pilotTargets = allTargets.filter((target) => {
            const targetType = typeof target?.type === 'string' ? target.type.toLowerCase() : '';
            const filterCardType = typeof target?.filters?.cardType === 'string'
              ? target.filters.cardType.toLowerCase()
              : '';
            return targetType === 'pilot' || filterCardType === 'pilot';
          });
          if (pilotTargets.length === 0) {
            continue;
          }

          const hasPilotLevelFilter = pilotTargets.some((target) =>
            target?.filters && Object.prototype.hasOwnProperty.call(target.filters, 'level')
          );
          if (!hasPilotLevelFilter) {
            issues.push(issueFactory({
              issueId: `pilot_level_filter_mismatch_${file}_${cardId}_${index}_${segment.index}`,
              severity: 'P1',
              confidence: 0.95,
              category: 'pilot-level-filter-mismatch',
              cardId,
              file,
              rulePath: `cards.${cardId}.effects.rules[${index}]`,
              currentSchema: {
                descriptionLine: segment.line,
                rule
              },
              expectedCanonicalSchema: {
                targetFilters: {
                  cardType: 'pilot',
                  level: '<=N | >=N'
                }
              },
              behavioralRisk: 'Pilot level text can resolve with wrong target eligibility.',
              recommendedFix: 'Add pilot target level filter (`target.filters.level`) matching description.'
            }));
            continue;
          }

          if ((mentionsPairedEnemyUnit || mentionsEnemyUnitLevel)) {
            const hasPairedUnitGate = pilotTargets.some((target) =>
              target?.filters && Object.prototype.hasOwnProperty.call(target.filters, 'pairedUnitLevel')
            );
            if (!hasPairedUnitGate) {
              issues.push(issueFactory({
                issueId: `pilot_pairing_gate_mismatch_${file}_${cardId}_${index}_${segment.index}`,
                severity: 'P1',
                confidence: 0.9,
                category: 'pilot-level-filter-mismatch',
                cardId,
                file,
                rulePath: `cards.${cardId}.effects.rules[${index}]`,
                currentSchema: {
                  descriptionLine: segment.line,
                  rule
                },
                expectedCanonicalSchema: {
                  targetFilters: {
                    cardType: 'pilot',
                    pairedUnitLevel: '<=N | >=N'
                  }
                },
                behavioralRisk: 'Pilot target may ignore paired enemy-unit level constraints from card text.',
                recommendedFix: 'Add `target.filters.pairedUnitLevel` when description constrains paired enemy unit level.'
              }));
            }
          }
        }
      }
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
  const manifest = loadManifest(baseDir, options.manifestPath);
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
    ...detectSourceExclusionConsistency(inventory),
    ...detectOptionalExileIfYouDoMismatch(baseDir, files),
    ...detectPilotLevelRuleMismatch(baseDir, files)
  ]);
  const allowlistedIssues = issues.filter((issue) =>
    manifest.intentionalDivergenceAllowlist.some((entry) => issueMatchesAllowlist(issue, entry))
  );
  const filteredIssues = issues.filter((issue) =>
    !manifest.intentionalDivergenceAllowlist.some((entry) => issueMatchesAllowlist(issue, entry))
  );

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
    issues: filteredIssues,
    allowlistedIssues,
    summaryByCategory: summarizeBy(filteredIssues, 'category'),
    summaryBySeverity: summarizeBy(filteredIssues, 'severity'),
    manifest: {
      manifestPath: manifest.manifestPath,
      canonicalizationRuleCount: manifest.canonicalizationRules.length,
      allowlistCount: manifest.intentionalDivergenceAllowlist.length
    }
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
