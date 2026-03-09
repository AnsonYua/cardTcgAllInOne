const fs = require('fs');
const path = require('path');

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

const PLACEHOLDER_PATTERNS = [
  /not yet implemented/i,
  /design placeholder/i,
  /requires engine support/i,
  /\bTODO\b/i
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

function classifyFeatureFamily(entry) {
  const text = `${entry.action} ${entry.reason}`.toLowerCase();

  if (/discard|exile|cost|replace_cost|destroy-friendly-unit|rest this unit/.test(text)) {
    return 'cost-system';
  }
  if (/source ap|source hp|source level|paired|dynamic|attack target|damaged|lowest-hp|highest-level/.test(text)) {
    return 'dynamic-conditions-targeting';
  }
  if (/trigger|event|shield-area|battle-destroy|just linked|deployed this turn/.test(text)) {
    return 'trigger-event-coverage';
  }
  if (/top|deck|reveal|tutor|scry|bottom|random/.test(text)) {
    return 'deck-reveal-tutor';
  }
  if (/restrict|cannot|prevent set active|prevent pairing|required attack target|redirect/.test(text)) {
    return 'restriction-lock-status';
  }
  if (/keyword|high-maneuver|blocker|first strike|suppression|breach/.test(text)) {
    return 'keyword-continuous';
  }
  if (/then-steps|branch|conditional/.test(text)) {
    return 'branch-structure';
  }

  return 'misc-runtime-gap';
}

function mapOwnerModule(entry) {
  const action = String(entry.action || '').toLowerCase();
  const reason = String(entry.reason || '').toLowerCase();

  if (action === 'conditional' || action === 'sequence') {
    return 'src/services/effects/SequenceEffectManager.ts';
  }
  if (action === 'select_from_top_deck' || action === 'scry_top_deck' || /top|deck|reveal|bottom/.test(reason)) {
    return 'src/services/effects/TopDeckSelectionManager.ts + src/services/effects/ScryTopDeckManager.ts';
  }
  if (action === 'replace_cost' || /cost|discard|exile/.test(reason)) {
    return 'src/services/costs/CostReplacementManager.ts + src/services/effects/actions/EffectDiscardActions.ts';
  }
  if (action === 'allow_attack_target' || action === 'require_attack_target_if_available' || /attack target/.test(reason)) {
    return 'src/services/attack/AllowAttackTargetRuleEvaluator.ts + src/services/battle/ForcedAttackTargetManager.ts';
  }
  if (action === 'restrict_set_active' || action === 'restrict_pairing' || action === 'prevent_set_active_next_turn') {
    return 'src/services/restrictions/UnitRestrictionUtils.ts + src/services/TurnLifecycleManager.ts';
  }
  if (action === 'conditionaltokendeploy') {
    return 'src/services/effects/ConditionalTokenDeployManager.ts';
  }
  if (action === 'registerdelayedtrigger') {
    return 'src/services/effects/DelayedTriggerManager.ts';
  }
  if (/condition|source|event|paired|battle|shield/.test(reason)) {
    return 'src/services/conditions/EffectConditionEvaluator.ts';
  }

  return 'src/services/effects/EffectExecutor.ts';
}

function extractNotes(rule) {
  const payload = JSON.stringify(rule);
  return [...payload.matchAll(/"notes"\s*:\s*"([^"]{1,500})"/g)].map((match) => match[1]);
}

function buildUnresolvedCatalog(baseDir, cardFiles = DEFAULT_CARD_FILES) {
  const entries = [];

  for (const file of cardFiles) {
    const dataPath = path.join(baseDir, 'src', 'data', file);
    const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const cards = json.cards || {};

    for (const [cardId, card] of Object.entries(cards)) {
      const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
      for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
        const rule = rules[ruleIndex];
        const notes = extractNotes(rule);
        if (notes.length === 0) {
          continue;
        }

        for (const reason of notes) {
          if (!PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(reason))) {
            continue;
          }

          const baseEntry = {
            file,
            cardId,
            cardName: card?.name || '',
            ruleIndex,
            effectId: typeof rule?.effectId === 'string' ? rule.effectId : '',
            action: typeof rule?.action === 'string' ? rule.action : '',
            reason,
            rulePath: `cards.${cardId}.effects.rules[${ruleIndex}]`
          };

          const entry = {
            ...baseEntry,
            issueId: stableStringify(baseEntry),
            featureFamily: classifyFeatureFamily(baseEntry),
            ownerModule: mapOwnerModule(baseEntry)
          };
          entries.push(entry);
        }
      }
    }
  }

  const unique = new Map();
  for (const entry of entries) {
    if (!unique.has(entry.issueId)) {
      unique.set(entry.issueId, entry);
    }
  }

  const deduped = [...unique.values()].sort((a, b) => {
    const left = `${a.file}:${a.cardId}:${a.ruleIndex}:${a.effectId}:${a.reason}`;
    const right = `${b.file}:${b.cardId}:${b.ruleIndex}:${b.effectId}:${b.reason}`;
    return left.localeCompare(right);
  });

  const summaryByFile = {};
  const summaryByFeatureFamily = {};
  for (const entry of deduped) {
    summaryByFile[entry.file] = (summaryByFile[entry.file] || 0) + 1;
    summaryByFeatureFamily[entry.featureFamily] = (summaryByFeatureFamily[entry.featureFamily] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    filesScanned: cardFiles,
    total: deduped.length,
    summaryByFile,
    summaryByFeatureFamily,
    entries: deduped
  };
}

module.exports = {
  DEFAULT_CARD_FILES,
  PLACEHOLDER_PATTERNS,
  buildUnresolvedCatalog
};
