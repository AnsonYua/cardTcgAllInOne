const fs = require('fs');
const path = require('path');

require('ts-node/register/transpile-only');
const {
  CANONICAL_EFFECT_TRIGGERS,
  CANONICAL_CONDITION_TYPES,
  CANONICAL_SELECTION_TYPES,
  CANONICAL_TARGET_FILTER_KEYS,
  SEQUENCE_INTERNAL_CONDITION_TYPES,
  normalizeConditionTypeAlias,
  normalizeSelectionTypeAlias
} = require('../../services/effects/schema/EffectSchema.ts');

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
  'st08Card.json'
];

function loadCardFile(fileName) {
  const filePath = path.join(__dirname, '..', '..', 'data', fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateConditionEntry(condition, conditionPath, context, diagnostics, options = {}) {
  const allowSequenceInternal = options.allowSequenceInternal === true;
  const allowedType = (type) =>
    CANONICAL_CONDITION_TYPES.has(type) ||
    (allowSequenceInternal && SEQUENCE_INTERNAL_CONDITION_TYPES.has(type));

  if (typeof condition === 'string') {
    if (!allowedType(condition)) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: conditionPath,
        message: `unknown string condition ${condition}`
      });
    }
    return;
  }

  if (!condition || typeof condition !== 'object') {
    diagnostics.push({
      severity: 'error',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: conditionPath,
      message: 'invalid condition shape'
    });
    return;
  }

  const rawType = typeof condition.type === 'string' ? condition.type : '';
  const normalizedType = normalizeConditionTypeAlias(rawType);
  if (!rawType) {
    diagnostics.push({
      severity: 'error',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: `${conditionPath}.type`,
      message: 'condition.type must be a non-empty string'
    });
    return;
  }

  if (normalizedType !== rawType) {
    diagnostics.push({
      severity: 'error',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: `${conditionPath}.type`,
      message: `non-canonical condition alias ${rawType}; use ${normalizedType}`
    });
  }

  if (!allowedType(normalizedType)) {
    diagnostics.push({
      severity: 'error',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: `${conditionPath}.type`,
      message: `unknown condition type ${rawType}`
    });
  }
}

function walkEffects(node, context, diagnostics) {
  if (Array.isArray(node)) {
    node.forEach((entry, index) => {
      walkEffects(entry, { ...context, jsonPath: `${context.jsonPath}[${index}]` }, diagnostics);
    });
    return;
  }

  if (!node || typeof node !== 'object') {
    return;
  }

  const nextContext = { ...context };
  if (typeof node.effectId === 'string' && node.effectId.length > 0) {
    nextContext.effectId = node.effectId;
  }

  if (typeof node.trigger === 'string' && typeof nextContext.effectId === 'string') {
    const triggerPath = `${context.jsonPath}.trigger`;
    if (!CANONICAL_EFFECT_TRIGGERS.has(node.trigger)) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: nextContext.effectId,
        jsonPath: triggerPath,
        message:
          node.trigger === 'CUSTOM'
            ? 'trigger CUSTOM is not allowed; migrate to explicit trigger enums'
            : `unknown trigger ${node.trigger}`
      });
    }
  }

  if (Array.isArray(node.conditions)) {
    node.conditions.forEach((condition, index) => {
      const conditionPath = `${context.jsonPath}.conditions[${index}]`;
      validateConditionEntry(condition, conditionPath, {
        cardId: context.cardId,
        effectId: nextContext.effectId
      }, diagnostics);
    });
  }

  if (Array.isArray(node.if)) {
    node.if.forEach((condition, index) => {
      const conditionPath = `${context.jsonPath}.if[${index}]`;
      validateConditionEntry(condition, conditionPath, {
        cardId: context.cardId,
        effectId: nextContext.effectId
      }, diagnostics, { allowSequenceInternal: true });
    });
  }

  if (node.target && typeof node.target === 'object' && node.target.selection && typeof node.target.selection === 'object') {
    const selection = node.target.selection;
    const rawType = typeof selection.type === 'string' ? selection.type : '';
    const rawTieBreaker = typeof selection.tieBreaker === 'string' ? selection.tieBreaker : undefined;
    const pathBase = `${context.jsonPath}.target.selection`;
    if (!rawType) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: nextContext.effectId || 'unknown',
        jsonPath: `${pathBase}.type`,
        message: 'selection.type must be a non-empty string'
      });
    } else {
      const normalized = normalizeSelectionTypeAlias(rawType, rawTieBreaker);
      if (normalized.type !== rawType) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: nextContext.effectId || 'unknown',
          jsonPath: `${pathBase}.type`,
          message: `non-canonical selection type ${rawType}; use ${normalized.type}`
        });
      }
      if (!CANONICAL_SELECTION_TYPES.has(normalized.type)) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: nextContext.effectId || 'unknown',
          jsonPath: `${pathBase}.type`,
          message: `unknown selection type ${rawType}`
        });
      }
    }
  }

  if (node.target && typeof node.target === 'object' && node.target.filters && typeof node.target.filters === 'object') {
    for (const filterKey of Object.keys(node.target.filters)) {
      if (!CANONICAL_TARGET_FILTER_KEYS.has(filterKey)) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: nextContext.effectId || 'unknown',
          jsonPath: `${context.jsonPath}.target.filters.${filterKey}`,
          message: `unknown target filter key ${filterKey}`
        });
      }
    }
  }

  for (const [key, value] of Object.entries(node)) {
    walkEffects(value, { ...nextContext, jsonPath: `${context.jsonPath}.${key}` }, diagnostics);
  }
}

function validateCardLinks(fileName, cards, diagnostics) {
  for (const [cardId, card] of Object.entries(cards)) {
    if (!Array.isArray(card.link)) {
      continue;
    }
    card.link.forEach((entry, index) => {
      if (typeof entry !== 'string') {
        return;
      }
      if (entry.includes('[') || entry.includes(']')) {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId: 'link',
          jsonPath: `cards.${cardId}.link[${index}]`,
          message: `malformed link entry in ${fileName}: remove stray brackets`
        });
      }
    });
  }
}

function validateEffectSchemaCanonical() {
  const diagnostics = [];

  for (const fileName of CARD_FILES) {
    const json = loadCardFile(fileName);
    const cards = json.cards || {};
    validateCardLinks(fileName, cards, diagnostics);

    for (const [cardId, card] of Object.entries(cards)) {
      const rules = card && card.effects && Array.isArray(card.effects.rules) ? card.effects.rules : [];
      walkEffects(rules, { cardId, effectId: 'unknown', jsonPath: `cards.${cardId}.effects.rules` }, diagnostics);
    }
  }

  if (diagnostics.length > 0) {
    const lines = diagnostics.map((d) =>
      `[${d.severity}] ${d.cardId}:${d.effectId} ${d.jsonPath} - ${d.message}`
    );
    throw new Error(lines.join('\n'));
  }

  console.log('OK: canonical effect schema validation');
}

module.exports = {
  validateEffectSchemaCanonical
};
