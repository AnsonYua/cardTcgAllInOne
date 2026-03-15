const fs = require('fs');
const path = require('path');
const {
  hasAlwaysOnKeywordText,
  hasRepairRule,
  hasBlockerRule,
  hasBreachRule,
  hasRuleCapability,
  getNormalizedTrigger
} = require('./alwaysOnEffectUtils');
const {
  validateActionSemantics,
  validateScryTopDeckParameters
} = require('./effectActionSemanticValidators');

require('ts-node/register/transpile-only');
const {
  CANONICAL_EFFECT_TRIGGERS,
  CANONICAL_CONDITION_TYPES,
  CANONICAL_SELECTION_TYPES,
  CANONICAL_TARGET_FILTER_KEYS,
  CANONICAL_SCALING_TYPES,
  SEQUENCE_INTERNAL_CONDITION_TYPES,
  SEQUENCE_SUPPORTED_STEP_ACTIONS,
  normalizeEffectTriggerAlias,
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
  'st08Card.json',
  'st09Card.json'
];

const LEVEL_COMPARISON_LITERAL_REGEX = /^(<=|>=|<|>|==|!=)\d+$/;
const LEVEL_DYNAMIC_PLACEHOLDER_REGEX = /^(<=|>=|<|>|==|!=)\s*(SOURCE_LEVEL|sourceLevel|EVENT_ATTACKER_LEVEL|eventAttackerLevel|RESTED_UNIT_LEVEL|restedUnitLevel)$/;
const SOURCE_LEVEL_SCOPE_VALUES = new Set(['paired_unit', 'source_card']);
const RETURN_TO_HAND_ALLOWED_TYPES = new Set(['unit', 'pilot', 'card']);
const RETURN_TO_HAND_SOURCE_CONTROLLER_WHITELIST = new Set([]);

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

  if (normalizedType === 'unitRestedByEffectEvent' || normalizedType === 'unitStateChangedByEffectEvent') {
    if (
      Object.prototype.hasOwnProperty.call(condition, 'targetCarduid') &&
      typeof condition.targetCarduid !== 'string'
    ) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: `${conditionPath}.targetCarduid`,
        message: 'targetCarduid must be a string'
      });
    }

    const validateController = (value, field) => {
      if (!Object.prototype.hasOwnProperty.call(condition, field)) {
        return;
      }
      if (typeof value !== 'string') {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${conditionPath}.${field}`,
          message: `${field} must be a string`
        });
        return;
      }
      const normalized = value.toLowerCase();
      if (!['self', 'opponent', 'any'].includes(normalized)) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${conditionPath}.${field}`,
          message: `${field} must be one of self|opponent|any`
        });
      }
    };
    validateController(condition.sourceController, 'sourceController');
    validateController(condition.targetController, 'targetController');
  }

  if (normalizedType === 'unitStateChangedByEffectEvent') {
    if (!Object.prototype.hasOwnProperty.call(condition, 'toState')) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: `${conditionPath}.toState`,
        message: 'unitStateChangedByEffectEvent requires toState'
      });
    }

    const validateStateField = (fieldName) => {
      if (!Object.prototype.hasOwnProperty.call(condition, fieldName)) {
        return;
      }
      const value = condition[fieldName];
      if (typeof value !== 'string') {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${conditionPath}.${fieldName}`,
          message: `${fieldName} must be a string`
        });
        return;
      }
      const normalized = value.toLowerCase();
      if (!['rested', 'active'].includes(normalized)) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${conditionPath}.${fieldName}`,
          message: `${fieldName} must be one of rested|active`
        });
      }
    };

    validateStateField('toState');
    validateStateField('fromState');
  }

  if (Object.prototype.hasOwnProperty.call(condition, 'excludeSourceCard')) {
    const supportsExcludeSourceCard =
      normalizedType === 'cardsInTrash' ||
      normalizedType === 'cardsInTrashWithTraitsAny' ||
      normalizedType === 'cardsInTrashWithNameIncludes';
    if (!supportsExcludeSourceCard) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: `${conditionPath}.excludeSourceCard`,
        message: `excludeSourceCard is not supported for condition type ${normalizedType}`
      });
    } else if (typeof condition.excludeSourceCard !== 'boolean') {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: `${conditionPath}.excludeSourceCard`,
        message: 'excludeSourceCard must be a boolean when provided'
      });
    }
  }
}

function validateReturnToHandSemantics(node, context, diagnostics) {
  if (!node || typeof node !== 'object' || node.action !== 'returnToHand') {
    return;
  }

  const target = node.target && typeof node.target === 'object' ? node.target : {};
  const targetType = typeof target.type === 'string' ? target.type.toLowerCase() : '';
  const scope = typeof target.scope === 'string' ? target.scope.toLowerCase() : '';
  const parameters = node.parameters && typeof node.parameters === 'object' ? node.parameters : {};
  const ownershipPolicyRaw = parameters.ownershipPolicy;
  const destinationOwnerRaw = parameters.destination && typeof parameters.destination === 'object'
    ? parameters.destination.owner
    : undefined;
  const normalizedOwnershipPolicy = typeof ownershipPolicyRaw === 'string'
    ? ownershipPolicyRaw.toUpperCase()
    : undefined;
  const normalizedDestinationOwner = typeof destinationOwnerRaw === 'string'
    ? destinationOwnerRaw.toUpperCase()
    : undefined;
  const effectiveOwnershipPolicy = normalizedDestinationOwner || normalizedOwnershipPolicy;

  if (!RETURN_TO_HAND_ALLOWED_TYPES.has(targetType)) {
    diagnostics.push({
      severity: 'warning',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: `${context.jsonPath}.target.type`,
      message: `returnToHand target.type should be one of unit|pilot|card (got ${target.type || 'missing'})`
    });
  }

  if (targetType === 'card' && !(scope.startsWith('source') || scope.startsWith('opponent') || scope.startsWith('self'))) {
    diagnostics.push({
      severity: 'warning',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: `${context.jsonPath}.target.scope`,
      message: `returnToHand with target.type=card should declare an explicit source/self/opponent scope (got ${target.scope || 'missing'})`
    });
  }

  if (!scope.startsWith('opponent') && !effectiveOwnershipPolicy) {
    diagnostics.push({
      severity: 'warning',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: `${context.jsonPath}.parameters`,
      message: 'returnToHand using non-opponent scope should declare ownershipPolicy or destination.owner explicitly'
    });
  }

  if (
    effectiveOwnershipPolicy === 'SOURCE_CONTROLLER' &&
    !RETURN_TO_HAND_SOURCE_CONTROLLER_WHITELIST.has(context.cardId)
  ) {
    diagnostics.push({
      severity: 'warning',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: `${context.jsonPath}.parameters.ownershipPolicy`,
      message: 'returnToHand ownershipPolicy SOURCE_CONTROLLER is not allowed unless explicitly whitelisted'
    });
  }
}

function validateLegacyDiscardFromHandCostPlacement(node, context, diagnostics) {
  if (!node || typeof node !== 'object') {
    return;
  }

  const parameters = node.parameters && typeof node.parameters === 'object' ? node.parameters : null;
  if (!parameters || !Object.prototype.hasOwnProperty.call(parameters, 'discardFromHand')) {
    return;
  }

  const hasCanonicalCost = Boolean(
    node.cost &&
    typeof node.cost === 'object' &&
    Object.prototype.hasOwnProperty.call(node.cost, 'discardFromHand')
  );
  if (hasCanonicalCost) {
    return;
  }

  diagnostics.push({
    severity: 'warning',
    cardId: context.cardId,
    effectId: context.effectId || 'unknown',
    jsonPath: `${context.jsonPath}.parameters.discardFromHand`,
    message: 'discardFromHand cost should be declared under cost.discardFromHand (not parameters.discardFromHand)'
  });
}

function validateSequenceStructure(node, context, diagnostics) {
  if (!node || typeof node !== 'object' || node.action !== 'sequence') {
    return;
  }

  const parameters = node.parameters && typeof node.parameters === 'object' ? node.parameters : null;
  const paramsPath = `${context.jsonPath}.parameters`;
  if (!parameters) {
    diagnostics.push({
      severity: 'error',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: paramsPath,
      message: 'sequence requires parameters object'
    });
    return;
  }

  const steps = parameters.steps;
  if (!Array.isArray(steps)) {
    diagnostics.push({
      severity: 'error',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath: `${paramsPath}.steps`,
      message: 'sequence parameters.steps must be an array'
    });
    return;
  }

  steps.forEach((step, index) => {
    const stepPath = `${paramsPath}.steps[${index}]`;
    if (!step || typeof step !== 'object') {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: stepPath,
        message: 'sequence step must be an object'
      });
      return;
    }

    const stepAction = typeof step.action === 'string' ? step.action : '';
    if (!stepAction) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: `${stepPath}.action`,
        message: 'sequence step action must be a non-empty string'
      });
      return;
    }

    if (!SEQUENCE_SUPPORTED_STEP_ACTIONS.has(stepAction)) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: `${stepPath}.action`,
        message: `unsupported sequence step action ${stepAction}`
      });
      return;
    }

    const stepParams = step.parameters && typeof step.parameters === 'object' ? step.parameters : {};
    if (stepAction === 'conditional') {
      if (!Array.isArray(stepParams.then)) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${stepPath}.parameters.then`,
          message: 'conditional sequence step requires parameters.then array'
        });
      }
      if (
        Object.prototype.hasOwnProperty.call(stepParams, 'else') &&
        !Array.isArray(stepParams.else)
      ) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${stepPath}.parameters.else`,
          message: 'conditional sequence step parameters.else must be an array when provided'
        });
      }
    }

    if (stepAction === 'discard') {
      const value = stepParams.value;
      const count = step.target && typeof step.target === 'object' ? step.target.count : undefined;
      const hasPositiveValue = typeof value === 'number' && value > 0;
      const hasPositiveCount = typeof count === 'number' && count > 0;
      if (!hasPositiveValue && !hasPositiveCount) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: stepPath,
          message: 'discard sequence step requires positive parameters.value or target.count'
        });
      }
    }

    if (stepAction === 'moveTopDeckToTrash') {
      if (!(typeof stepParams.count === 'number' && stepParams.count > 0)) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${stepPath}.parameters.count`,
          message: 'moveTopDeckToTrash sequence step requires parameters.count > 0'
        });
      }
    }

    if (stepAction === 'registerDelayedTrigger') {
      if (typeof stepParams.duration !== 'string' || stepParams.duration.length === 0) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${stepPath}.parameters.duration`,
          message: 'registerDelayedTrigger sequence step requires parameters.duration'
        });
      }
      if (!stepParams.trigger || typeof stepParams.trigger !== 'object') {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${stepPath}.parameters.trigger`,
          message: 'registerDelayedTrigger sequence step requires parameters.trigger object'
        });
      }
      if (!Array.isArray(stepParams.then) || stepParams.then.length === 0) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${stepPath}.parameters.then`,
          message: 'registerDelayedTrigger sequence step requires non-empty parameters.then array'
        });
      }
    }
  });
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
    const normalizedTrigger = normalizeEffectTriggerAlias(node.trigger);
    if (normalizedTrigger !== node.trigger) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: nextContext.effectId,
        jsonPath: triggerPath,
        message: `non-canonical trigger alias ${node.trigger}; use ${normalizedTrigger}`
      });
    }
    if (!CANONICAL_EFFECT_TRIGGERS.has(normalizedTrigger)) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: nextContext.effectId,
        jsonPath: triggerPath,
        message:
          normalizedTrigger === 'CUSTOM'
            ? 'trigger CUSTOM is not allowed; migrate to explicit trigger enums'
            : `unknown trigger ${node.trigger}`
      });
    }
  }

  if (node.action === 'restrict_attack' && node.parameters && typeof node.parameters === 'object') {
    if (Object.prototype.hasOwnProperty.call(node.parameters, 'restriction')) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: nextContext.effectId || 'unknown',
        jsonPath: `${context.jsonPath}.parameters.restriction`,
        message: 'restrict_attack.parameters.restriction is deprecated; use parameters.disallow'
      });
    }
  }

  if (node.action === 'restrict_attack') {
    if (!node.parameters || typeof node.parameters !== 'object') {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: nextContext.effectId || 'unknown',
        jsonPath: `${context.jsonPath}.parameters`,
        message: 'restrict_attack requires a parameters object'
      });
    } else {
      const hasDisallow = Object.prototype.hasOwnProperty.call(node.parameters, 'disallow');
      const hasRequires = Object.prototype.hasOwnProperty.call(node.parameters, 'requires');
      if (!hasDisallow && !hasRequires) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: nextContext.effectId || 'unknown',
          jsonPath: `${context.jsonPath}.parameters`,
          message: 'restrict_attack must use parameters.disallow or parameters.requires'
        });
      }
      if (hasDisallow && hasRequires) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: nextContext.effectId || 'unknown',
          jsonPath: `${context.jsonPath}.parameters`,
          message: 'restrict_attack cannot define both disallow and requires'
        });
      }
      if (hasDisallow && typeof node.parameters.disallow !== 'string' && typeof node.parameters.disallow !== 'boolean') {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: nextContext.effectId || 'unknown',
          jsonPath: `${context.jsonPath}.parameters.disallow`,
          message: 'restrict_attack parameters.disallow must be string or boolean'
        });
      }
      if (hasRequires) {
        const requires = node.parameters.requires;
        if (!requires || typeof requires !== 'object' || typeof requires.type !== 'string') {
          diagnostics.push({
            severity: 'error',
            cardId: context.cardId,
            effectId: nextContext.effectId || 'unknown',
            jsonPath: `${context.jsonPath}.parameters.requires`,
            message: 'restrict_attack parameters.requires must be an object with a string type'
          });
        }
      }
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

  if (Object.prototype.hasOwnProperty.call(node, 'sourceLevelScope')) {
    if (!SOURCE_LEVEL_SCOPE_VALUES.has(node.sourceLevelScope)) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: nextContext.effectId || 'unknown',
        jsonPath: `${context.jsonPath}.sourceLevelScope`,
        message: `sourceLevelScope must be one of: ${[...SOURCE_LEVEL_SCOPE_VALUES].join(', ')}`
      });
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

    const levelFilter = node.target.filters.level;
    if (typeof levelFilter === 'string') {
      const containsPlaceholderText = /[A-Za-z_]/.test(levelFilter);
      const allowed =
        LEVEL_COMPARISON_LITERAL_REGEX.test(levelFilter) ||
        LEVEL_DYNAMIC_PLACEHOLDER_REGEX.test(levelFilter);

      if (containsPlaceholderText && !allowed) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: nextContext.effectId || 'unknown',
          jsonPath: `${context.jsonPath}.target.filters.level`,
          message: `unknown dynamic level placeholder ${levelFilter}`
        });
      }
    }
  }

  if (node.parameters && typeof node.parameters === 'object') {
    const scaling = node.parameters.scaling;
    if (scaling !== undefined) {
      validateScalingConfig(
        scaling,
        `${context.jsonPath}.parameters.scaling`,
        { cardId: context.cardId, effectId: nextContext.effectId || 'unknown' },
        diagnostics
      );
    }
  }

  validateReturnToHandSemantics(node, {
    cardId: context.cardId,
    effectId: nextContext.effectId || 'unknown',
    jsonPath: context.jsonPath
  }, diagnostics);
  validateLegacyDiscardFromHandCostPlacement(node, {
    cardId: context.cardId,
    effectId: nextContext.effectId || 'unknown',
    jsonPath: context.jsonPath
  }, diagnostics);
  validateActionSemantics(node, {
    cardId: context.cardId,
    effectId: nextContext.effectId || 'unknown',
    jsonPath: context.jsonPath,
    cardType: context.cardType
  }, diagnostics);
  validateSequenceStructure(node, {
    cardId: context.cardId,
    effectId: nextContext.effectId || 'unknown',
    jsonPath: context.jsonPath
  }, diagnostics);

  for (const [key, value] of Object.entries(node)) {
    walkEffects(value, { ...nextContext, jsonPath: `${context.jsonPath}.${key}` }, diagnostics);
  }
}

function validateScalingConfig(scaling, jsonPath, context, diagnostics) {
  if (!scaling || typeof scaling !== 'object') {
    diagnostics.push({
      severity: 'error',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath,
      message: 'scaling must be an object'
    });
    return;
  }

  const hasType = typeof scaling.type === 'string' && scaling.type.length > 0;
  const isSourceApLegacyShape =
    String(scaling.stat || '').toLowerCase() === 'ap' &&
    String(scaling.scope || '').toLowerCase() === 'source' &&
    typeof scaling.per === 'number' &&
    scaling.per > 0;

  if (hasType) {
    const normalizedType = String(scaling.type).toUpperCase();
    if (!CANONICAL_SCALING_TYPES.has(normalizedType)) {
      diagnostics.push({
        severity: 'error',
        cardId: context.cardId,
        effectId: context.effectId || 'unknown',
        jsonPath: `${jsonPath}.type`,
        message: `unknown scaling type ${scaling.type}`
      });
      return;
    }

    if (normalizedType === 'COUNT_UNITS_IN_PLAY') {
      if (scaling.multiplier !== undefined && typeof scaling.multiplier !== 'number') {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${jsonPath}.multiplier`,
          message: 'COUNT_UNITS_IN_PLAY multiplier must be numeric'
        });
      }
      return;
    }

    if (normalizedType === 'COUNT_UNIQUE_CARDS_IN_TRASH') {
      if (scaling.multiplier !== undefined && typeof scaling.multiplier !== 'number') {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${jsonPath}.multiplier`,
          message: 'COUNT_UNIQUE_CARDS_IN_TRASH multiplier must be numeric'
        });
      }
      return;
    }

    if (normalizedType === 'SOURCE_AP_PER') {
      if (!(typeof scaling.per === 'number' && scaling.per > 0)) {
        diagnostics.push({
          severity: 'error',
          cardId: context.cardId,
          effectId: context.effectId || 'unknown',
          jsonPath: `${jsonPath}.per`,
          message: 'SOURCE_AP_PER requires per > 0'
        });
      }
      return;
    }
  }

  if (!isSourceApLegacyShape) {
    diagnostics.push({
      severity: 'error',
      cardId: context.cardId,
      effectId: context.effectId || 'unknown',
      jsonPath,
      message: 'scaling uses unsupported shape'
    });
  }
}

function detectAlwaysOnTextRuleMismatches(fileName, cards, diagnostics) {
  for (const [cardId, card] of Object.entries(cards)) {
    const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
    const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
    if (descriptions.length === 0) {
      continue;
    }

    const hasAlwaysOnRepairText = hasAlwaysOnKeywordText(descriptions, 'repair');
    const hasAlwaysOnBlockerText = hasAlwaysOnKeywordText(descriptions, 'blocker');
    const hasAlwaysOnBreachText = hasAlwaysOnKeywordText(descriptions, 'breach');

    const hasRepairRuleCapability = hasRepairRule(rules);
    const hasBlockerRuleCapability = hasBlockerRule(rules);
    const hasBreachRuleCapability = hasBreachRule(rules);
    const hasHealRuleCapability = hasRuleCapability(rules, (rule) => String(rule?.action || '').toLowerCase() === 'heal');
    const hasRedirectRuleCapability = hasRuleCapability(rules, (rule) => getNormalizedTrigger(rule) === 'ATTACK_REDIRECT');

    if (hasAlwaysOnRepairText && !hasRepairRuleCapability) {
      diagnostics.push({
        severity: 'warning',
        cardId,
        effectId: 'effects.description',
        jsonPath: `cards.${cardId}.effects.description`,
        message: `${fileName}: repair text present but no repair-capable rule found`
      });
    }
    if (hasAlwaysOnBlockerText && !hasBlockerRuleCapability) {
      diagnostics.push({
        severity: 'warning',
        cardId,
        effectId: 'effects.description',
        jsonPath: `cards.${cardId}.effects.description`,
        message: `${fileName}: blocker text present but no blocker-capable rule found`
      });
    }
    if (hasAlwaysOnBreachText && !hasBreachRuleCapability) {
      diagnostics.push({
        severity: 'warning',
        cardId,
        effectId: 'effects.description',
        jsonPath: `cards.${cardId}.effects.description`,
        message: `${fileName}: breach text present but no breach-capable rule found`
      });
    }

    const hasIntrinsicRepairLine = descriptions.some((line) => typeof line === 'string' && /^\s*<\s*repair\s*\d+\s*>/i.test(line));
    if (hasIntrinsicRepairLine && !hasHealRuleCapability) {
      diagnostics.push({
        severity: 'warning',
        cardId,
        effectId: 'effects.description',
        jsonPath: `cards.${cardId}.effects.description`,
        message: `${fileName}: intrinsic <Repair N> text should use heal-capable behavior encoding`
      });
    }

    const hasIntrinsicBlockerLine = descriptions.some((line) => typeof line === 'string' && /^\s*<\s*blocker\s*>/i.test(line));
    if (hasIntrinsicBlockerLine && !hasRedirectRuleCapability) {
      diagnostics.push({
        severity: 'warning',
        cardId,
        effectId: 'effects.description',
        jsonPath: `cards.${cardId}.effects.description`,
        message: `${fileName}: intrinsic <Blocker> text should use ATTACK_REDIRECT-capable behavior encoding`
      });
    }

    const hasBurstLine = descriptions.some((line) => typeof line === 'string' && /^(?:\[Burst\]|【Burst】)/i.test(line.trim()));
    const hasPlayFromHandPairingLine = descriptions.some(
      (line) => typeof line === 'string' && /^When playing this card from your hand\b/i.test(line.trim())
    );
    const hasPairTargetReplacementRule = rules.some((rule) => {
      if (!rule || typeof rule !== 'object') return false;
      if (rule.action !== 'replace_cost') return false;
      const fromType = rule?.parameters?.replace?.from?.type;
      return fromType === 'pair_target_unit';
    });

    if (hasBurstLine && hasPlayFromHandPairingLine && !hasPairTargetReplacementRule) {
      diagnostics.push({
        severity: 'warning',
        cardId,
        effectId: 'effects.description',
        jsonPath: `cards.${cardId}.effects.description`,
        message: `${fileName}: play-from-hand pairing cost text present but no pair_target_unit replace_cost rule found`
      });
    }
  }
}

function detectDescriptionRuleContractMismatches(fileName, cards, diagnostics) {
  for (const [cardId, card] of Object.entries(cards)) {
    const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
    const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
    if (descriptions.length === 0 || rules.length === 0) {
      continue;
    }

    const pairedByIndex = descriptions.length === rules.length;
    const cardText = descriptions.filter((line) => typeof line === 'string').join(' ');

    rules.forEach((rule, index) => {
      if (!rule || typeof rule !== 'object') {
        return;
      }

      const effectId = typeof rule.effectId === 'string' ? rule.effectId : 'unknown';
      const rulePath = `cards.${cardId}.effects.rules[${index}]`;
      const lineText = pairedByIndex && typeof descriptions[index] === 'string' ? descriptions[index] : cardText;

      if (rule.action === 'setActive') {
        const mentionsSelection = /choose\s+1/i.test(lineText);
        if (mentionsSelection) {
          const target = rule.target;
          const hasType = typeof target?.type === 'string' && target.type.length > 0;
          const hasScope = typeof target?.scope === 'string' && target.scope.length > 0;
          const hasCount = target && Object.prototype.hasOwnProperty.call(target, 'count');
          if (!hasType || !hasScope || !hasCount) {
            diagnostics.push({
              severity: 'error',
              cardId,
              effectId,
              jsonPath: `${rulePath}.target`,
              message: `${fileName}: setActive effects with explicit selection text must define target.type/scope/count`
            });
          }
        }
      }

      if (rule.action === 'prevent_battle_damage') {
        const referencesEnemyUnits = /enemy Units/i.test(lineText);
        const parameters = rule.parameters && typeof rule.parameters === 'object' ? rule.parameters : {};
        if (referencesEnemyUnits && !Object.prototype.hasOwnProperty.call(parameters, 'from')) {
          diagnostics.push({
            severity: 'error',
            cardId,
            effectId,
            jsonPath: `${rulePath}.parameters.from`,
            message: `${fileName}: prevent_battle_damage text references enemy Units but parameters.from is missing`
          });
        }
      }
    });
  }
}

function detectSupportActivatedSchemaMismatches(fileName, cards, diagnostics) {
  const supportTextRegex = /support/i;

  for (const [cardId, card] of Object.entries(cards)) {
    const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
    const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
    const hasSupportDescription = descriptions.some((line) => typeof line === 'string' && supportTextRegex.test(line));

    rules.forEach((rule, index) => {
      if (!rule || typeof rule !== 'object') return;
      if (String(rule.type || '').toLowerCase() !== 'activated') return;

      const effectId = typeof rule.effectId === 'string' ? rule.effectId : 'unknown';
      const action = typeof rule.action === 'string' ? rule.action : '';
      const ruleText = typeof rule?.parameters?.text === 'string' ? rule.parameters.text : '';
      const supportLike =
        hasSupportDescription ||
        supportTextRegex.test(effectId) ||
        supportTextRegex.test(ruleText);

      if (!supportLike) return;

      const rulePath = `cards.${cardId}.effects.rules[${index}]`;
      if (action === 'sequence') {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.action`,
          message: `${fileName}: support activated effects must be top-level modifyAP, not sequence`
        });
      }

      if (action !== 'modifyAP') {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.action`,
          message: `${fileName}: support activated effect action must be modifyAP`
        });
      }

      const windows = Array.isArray(rule?.timing?.windows) ? rule.timing.windows : [];
      const hasMainPhaseWindow = windows.some((window) => String(window).toUpperCase() === 'MAIN_PHASE');
      if (!hasMainPhaseWindow) {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.timing.windows`,
          message: `${fileName}: support activated effect must include MAIN_PHASE timing window`
        });
      }

      const restCost = rule?.cost?.rest;
      const restSelf = rule?.cost?.restSelf === true;
      if (restCost !== 'self' && !restSelf) {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.cost`,
          message: `${fileName}: support activated effect must rest self as cost`
        });
      }

      if (rule?.target?.type !== 'unit') {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.target.type`,
          message: `${fileName}: support activated effect target.type must be unit`
        });
      }

      if (rule?.target?.scope !== 'self') {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.target.scope`,
          message: `${fileName}: support activated effect target.scope must be self`
        });
      }

      if (rule?.target?.count !== 1) {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.target.count`,
          message: `${fileName}: support activated effect target.count must be 1`
        });
      }

      if (rule?.parameters?.excludeSource !== true) {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.parameters.excludeSource`,
          message: `${fileName}: support activated effect must set parameters.excludeSource=true`
        });
      }

      if (!(typeof rule?.parameters?.value === 'number' && rule.parameters.value > 0)) {
        diagnostics.push({
          severity: 'error',
          cardId,
          effectId,
          jsonPath: `${rulePath}.parameters.value`,
          message: `${fileName}: support activated effect must set parameters.value to a positive number`
        });
      }
    });
  }
}

function detectCommandPlayTimingWindowWarnings(fileName, cards, diagnostics) {
  for (const [cardId, card] of Object.entries(cards)) {
    if ((card?.cardType || '').toString().toLowerCase() !== 'command') {
      continue;
    }

    const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
    rules.forEach((rule, index) => {
      if (!rule || typeof rule !== 'object') {
        return;
      }

      if ((rule.type || '').toString().toLowerCase() !== 'play') {
        return;
      }

      const windows = Array.isArray(rule?.timing?.activationWindows) ? rule.timing.activationWindows : [];
      if (windows.length > 0) {
        return;
      }

      diagnostics.push({
        severity: 'warning',
        cardId,
        effectId: typeof rule.effectId === 'string' ? rule.effectId : 'unknown',
        jsonPath: `cards.${cardId}.effects.rules[${index}].timing.activationWindows`,
        message: `${fileName}: command play effect should define explicit timing.activationWindows (MAIN_PHASE/ACTION_STEP)`
      });
    });
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
    detectAlwaysOnTextRuleMismatches(fileName, cards, diagnostics);
    detectSupportActivatedSchemaMismatches(fileName, cards, diagnostics);
    detectCommandPlayTimingWindowWarnings(fileName, cards, diagnostics);
    detectDescriptionRuleContractMismatches(fileName, cards, diagnostics);

    for (const [cardId, card] of Object.entries(cards)) {
      const rules = card && card.effects && Array.isArray(card.effects.rules) ? card.effects.rules : [];
      walkEffects(rules, {
        cardId,
        cardType: card?.cardType,
        effectId: 'unknown',
        jsonPath: `cards.${cardId}.effects.rules`
      }, diagnostics);
    }
  }

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  if (warnings.length > 0) {
    const lines = warnings.map((d) =>
      `[warning] ${d.cardId}:${d.effectId} ${d.jsonPath} - ${d.message}`
    );
    console.warn(lines.join('\n'));
  }

  if (errors.length > 0) {
    const lines = errors.map((d) =>
      `[${d.severity}] ${d.cardId}:${d.effectId} ${d.jsonPath} - ${d.message}`
    );
    throw new Error(lines.join('\n'));
  }

  console.log('OK: canonical effect schema validation');
}

module.exports = {
  validateEffectSchemaCanonical,
  __testUtils: {
    validateConditionEntry,
    walkEffects,
    validateScalingConfig,
    detectAlwaysOnTextRuleMismatches,
    validateReturnToHandSemantics,
    validateLegacyDiscardFromHandCostPlacement,
    validateSequenceStructure,
    detectSupportActivatedSchemaMismatches,
    detectCommandPlayTimingWindowWarnings,
    detectDescriptionRuleContractMismatches,
    validateScryTopDeckParameters
  }
};
