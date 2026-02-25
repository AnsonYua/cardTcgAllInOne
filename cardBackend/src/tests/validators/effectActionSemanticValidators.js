require('ts-node/register/transpile-only');
const {
  CANONICAL_SCRY_CHOICES,
  CANONICAL_SCRY_REST_DESTINATIONS
} = require('../../services/effects/schema/EffectSchema.ts');

const NUMERIC_COMPARISON_LITERAL_REGEX = /^(<=|>=|<|>|==|!=)\d+$/;
const PREVENT_BATTLE_DAMAGE_ALLOWED_PARAM_KEYS = new Set([
  'from',
  'enemyLevel',
  'enemyAp',
  'maxEnemyAp',
  'enemyHp',
  'notes'
]);
const SCRY_TOP_DECK_LEGACY_ALLOWED_CHOICES = new Set([
  'top',
  'bottom',
  'trash'
]);

function pushDiagnostic(diagnostics, context, jsonPath, message, severity = 'error') {
  diagnostics.push({
    severity,
    cardId: context.cardId,
    effectId: context.effectId || 'unknown',
    jsonPath,
    message
  });
}

function validatePreventBattleDamageParameters(node, context, diagnostics) {
  if (!node || typeof node !== 'object' || node.action !== 'prevent_battle_damage') {
    return;
  }

  const parameters = node.parameters && typeof node.parameters === 'object' ? node.parameters : {};
  const paramsPath = `${context.jsonPath}.parameters`;

  for (const key of Object.keys(parameters)) {
    if (!PREVENT_BATTLE_DAMAGE_ALLOWED_PARAM_KEYS.has(key)) {
      pushDiagnostic(
        diagnostics,
        context,
        `${paramsPath}.${key}`,
        `prevent_battle_damage uses unsupported parameter key ${key}`
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(parameters, 'enemyAp') && typeof parameters.enemyAp !== 'string') {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.enemyAp`,
      'prevent_battle_damage enemyAp must be a comparison string like <=3'
    );
  } else if (typeof parameters.enemyAp === 'string' && !NUMERIC_COMPARISON_LITERAL_REGEX.test(parameters.enemyAp)) {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.enemyAp`,
      `prevent_battle_damage enemyAp must match comparison format (got ${parameters.enemyAp})`
    );
  }

  if (Object.prototype.hasOwnProperty.call(parameters, 'maxEnemyAp') && typeof parameters.maxEnemyAp !== 'number') {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.maxEnemyAp`,
      'prevent_battle_damage maxEnemyAp must be a number'
    );
  }

  if (Object.prototype.hasOwnProperty.call(parameters, 'enemyHp') && typeof parameters.enemyHp !== 'string') {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.enemyHp`,
      'prevent_battle_damage enemyHp must be a comparison string like <=2'
    );
  } else if (typeof parameters.enemyHp === 'string' && !NUMERIC_COMPARISON_LITERAL_REGEX.test(parameters.enemyHp)) {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.enemyHp`,
      `prevent_battle_damage enemyHp must match comparison format (got ${parameters.enemyHp})`
    );
  }

  if (Object.prototype.hasOwnProperty.call(parameters, 'enemyLevel') && typeof parameters.enemyLevel !== 'string') {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.enemyLevel`,
      'prevent_battle_damage enemyLevel must be a comparison string'
    );
  }

  const hasEnemyFilter =
    Object.prototype.hasOwnProperty.call(parameters, 'enemyLevel') ||
    Object.prototype.hasOwnProperty.call(parameters, 'enemyAp') ||
    Object.prototype.hasOwnProperty.call(parameters, 'maxEnemyAp') ||
    Object.prototype.hasOwnProperty.call(parameters, 'enemyHp');
  if (hasEnemyFilter && !Object.prototype.hasOwnProperty.call(parameters, 'from')) {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.from`,
      'prevent_battle_damage requires parameters.from when enemy filter keys are present'
    );
  }
}

function validateSetNameAliasParameters(node, context, diagnostics) {
  if (!node || typeof node !== 'object' || node.action !== 'set_name_alias') {
    return;
  }

  const parameters = node.parameters && typeof node.parameters === 'object' ? node.parameters : null;
  const aliasPath = `${context.jsonPath}.parameters.alsoTreatedAs`;
  if (!parameters) {
    pushDiagnostic(
      diagnostics,
      context,
      `${context.jsonPath}.parameters`,
      'set_name_alias requires parameters'
    );
    return;
  }

  const aliases = parameters.alsoTreatedAs;
  if (!Array.isArray(aliases) || aliases.length === 0) {
    pushDiagnostic(
      diagnostics,
      context,
      aliasPath,
      'set_name_alias requires a non-empty parameters.alsoTreatedAs array'
    );
    return;
  }

  aliases.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      pushDiagnostic(
        diagnostics,
        context,
        `${aliasPath}[${index}]`,
        'set_name_alias alias entries must be non-empty strings'
      );
    }
  });
}

function validateScryTopDeckParameters(node, context, diagnostics) {
  if (!node || typeof node !== 'object' || node.action !== 'scry_top_deck') {
    return;
  }

  const parameters = node.parameters && typeof node.parameters === 'object' ? node.parameters : {};
  const paramsPath = `${context.jsonPath}.parameters`;

  const hasCount = Object.prototype.hasOwnProperty.call(parameters, 'count');
  const hasLookCount = Object.prototype.hasOwnProperty.call(parameters, 'lookCount');
  const resolvedCountRaw = hasCount ? parameters.count : (hasLookCount ? parameters.lookCount : parameters.value);
  const resolvedCount = typeof resolvedCountRaw === 'number' ? resolvedCountRaw : Number(resolvedCountRaw);

  if (!Number.isFinite(resolvedCount) || resolvedCount <= 0) {
    pushDiagnostic(diagnostics, context, paramsPath, 'scry_top_deck requires count (or lookCount/value) > 0');
  }

  if (hasCount && hasLookCount && Number(parameters.count) !== Number(parameters.lookCount)) {
    pushDiagnostic(diagnostics, context, paramsPath, 'scry_top_deck count and lookCount must match when both are present');
  }

  if (Object.prototype.hasOwnProperty.call(parameters, 'keep')) {
    const keepValue = Number(parameters.keep);
    if (!Number.isInteger(keepValue) || keepValue < 0) {
      pushDiagnostic(diagnostics, context, `${paramsPath}.keep`, 'scry_top_deck keep must be an integer >= 0');
    }
  }

  const rawChoice = typeof parameters.choice === 'string' ? parameters.choice.toLowerCase() : '';
  if (rawChoice && !CANONICAL_SCRY_CHOICES.has(rawChoice)) {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.choice`,
      `scry_top_deck choice must be one of ${Array.from(CANONICAL_SCRY_CHOICES).join('|')}`
    );
  }

  const rawRest = typeof parameters.rest === 'string' ? parameters.rest.toLowerCase() : '';
  if (rawRest && !CANONICAL_SCRY_REST_DESTINATIONS.has(rawRest)) {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.rest`,
      `scry_top_deck rest must be one of ${Array.from(CANONICAL_SCRY_REST_DESTINATIONS).join('|')}`
    );
  }

  if (rawChoice === 'top_or_trash' && rawRest && rawRest !== 'trash') {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.rest`,
      'scry_top_deck choice=top_or_trash requires rest=trash when rest is provided'
    );
  }

  const hasLegacyChoices = Array.isArray(parameters.choices);
  if (hasLegacyChoices) {
    const normalizedLegacyChoices = parameters.choices
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.toLowerCase());

    const unknownLegacyChoice = normalizedLegacyChoices.find((entry) => !SCRY_TOP_DECK_LEGACY_ALLOWED_CHOICES.has(entry));
    if (unknownLegacyChoice) {
      pushDiagnostic(
        diagnostics,
        context,
        `${paramsPath}.choices`,
        `scry_top_deck legacy choices has unsupported value ${unknownLegacyChoice}`
      );
    }

    const hasTop = normalizedLegacyChoices.includes('top');
    const hasBottom = normalizedLegacyChoices.includes('bottom');
    const hasTrash = normalizedLegacyChoices.includes('trash');
    const supportedPair = (hasTop && hasBottom && !hasTrash) || (hasTop && hasTrash && !hasBottom);
    if (!supportedPair) {
      pushDiagnostic(
        diagnostics,
        context,
        `${paramsPath}.choices`,
        'scry_top_deck legacy choices must be [top,bottom] or [top,trash]'
      );
    }

    if (rawChoice) {
      const inferredLegacyChoice = hasBottom ? 'top_or_bottom' : (hasTrash ? 'top_or_trash' : '');
      if (inferredLegacyChoice && rawChoice !== inferredLegacyChoice) {
        pushDiagnostic(
          diagnostics,
          context,
          paramsPath,
          `scry_top_deck choice (${rawChoice}) conflicts with legacy choices (${inferredLegacyChoice})`
        );
      }
    }

    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.choices`,
      'scry_top_deck uses legacy choices; prefer canonical choice field',
      'warning'
    );
  }

  if (hasLookCount) {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.lookCount`,
      'scry_top_deck uses legacy lookCount; prefer canonical count field',
      'warning'
    );
  }

  if (Object.prototype.hasOwnProperty.call(parameters, 'bottom')) {
    pushDiagnostic(
      diagnostics,
      context,
      `${paramsPath}.bottom`,
      'scry_top_deck uses legacy bottom field; prefer canonical rest=bottom',
      'warning'
    );
  }
}

const ACTION_SEMANTIC_VALIDATORS = [
  validatePreventBattleDamageParameters,
  validateSetNameAliasParameters,
  validateScryTopDeckParameters
];

function validateActionSemantics(node, context, diagnostics) {
  for (const validator of ACTION_SEMANTIC_VALIDATORS) {
    validator(node, context, diagnostics);
  }
}

module.exports = {
  validateActionSemantics,
  validatePreventBattleDamageParameters,
  validateSetNameAliasParameters,
  validateScryTopDeckParameters
};
