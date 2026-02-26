const SLOT_NAMES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function matchesNumericComparison(actualValue, expression) {
  if (typeof expression === 'number') {
    return actualValue === expression;
  }
  if (typeof expression !== 'string') {
    return false;
  }

  const text = expression.trim();
  const match = text.match(/^(>=|<=|==|!=|>|<)?\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return false;
  }

  const op = match[1] || '==';
  const expected = Number(match[2]);

  switch (op) {
    case '>=': return actualValue >= expected;
    case '<=': return actualValue <= expected;
    case '>': return actualValue > expected;
    case '<': return actualValue < expected;
    case '!=': return actualValue !== expected;
    case '==':
    default:
      return actualValue === expected;
  }
}

function arraysIntersect(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return false;
  }
  const bSet = new Set(b.map(v => normalizeString(v)));
  return a.some(v => bSet.has(normalizeString(v)));
}

function isLinkedUnitPair(slot) {
  const unit = slot?.unit;
  const pilot = slot?.pilot;
  if (!unit || !pilot) return false;

  const unitLinks = Array.isArray(unit.cardData?.link) ? unit.cardData.link : [];
  const pilotName = normalizeString(pilot.cardData?.name);
  if (!pilotName || unitLinks.length === 0) return false;

  return unitLinks.some(name => normalizeString(name) === pilotName);
}

function unitMatchesFilters(slot, filters = {}) {
  const unit = slot?.unit;
  if (!unit || !unit.cardData) return false;

  const traitsFilter = Array.isArray(filters.traits) ? filters.traits : null;
  if (traitsFilter && !arraysIntersect(unit.cardData.traits || [], traitsFilter)) {
    return false;
  }

  if (typeof filters.isLinkUnit === 'boolean') {
    const linked = isLinkedUnitPair(slot);
    if (linked !== filters.isLinkUnit) {
      return false;
    }
  }

  return true;
}

function countUnitsInPlayWithFilter(gameEnv, playerId, condition) {
  if (!gameEnv?.players || !playerId) return 0;
  const scope = normalizeString(condition?.scope).toLowerCase();
  if (scope && scope !== 'self') {
    return 0;
  }

  const player = gameEnv.players[playerId];
  const zones = player?.zones || {};
  const filters = condition?.filters || {};
  let count = 0;

  for (const slotName of SLOT_NAMES) {
    const slot = zones[slotName];
    if (unitMatchesFilters(slot, filters)) {
      count += 1;
    }
  }

  return count;
}

function conditionMet(gameEnv, playerId, condition) {
  if (!condition || typeof condition !== 'object') {
    return false;
  }

  const type = normalizeString(condition.type);
  switch (type) {
    case 'unitsInPlayWithFilter': {
      const count = countUnitsInPlayWithFilter(gameEnv, playerId, condition);
      const expected = condition.value;
      if (expected === undefined) return count > 0;
      return matchesNumericComparison(count, expected);
    }
    default:
      return false;
  }
}

function allConditionsMet(gameEnv, playerId, conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return true;
  }
  return conditions.every(condition => conditionMet(gameEnv, playerId, condition));
}

export function evaluateHandPlayRequirements(gameEnv, playerId, handCard) {
  const sourceCardData = handCard?.cardData || handCard;
  const baseCost = Math.max(0, toNumber(sourceCardData?.cost, 0));
  const baseLevel = Math.max(0, toNumber(sourceCardData?.level, 0));

  let effectiveCost = baseCost;
  let effectiveLevel = baseLevel;
  const appliedModifiers = [];

  const rules = Array.isArray(sourceCardData?.effects?.rules) ? sourceCardData.effects.rules : [];
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;

    const type = normalizeString(rule.type).toLowerCase();
    const trigger = normalizeString(rule.trigger).toLowerCase();
    const action = normalizeString(rule.action);
    const scope = normalizeString(rule?.target?.scope).toLowerCase();

    if (type !== 'continuous' || trigger !== 'continuous') continue;
    if (!scope.includes('hand')) continue;
    if (!allConditionsMet(gameEnv, playerId, rule.conditions || [])) continue;

    const delta = toNumber(rule?.parameters?.value, 0);
    if (action === 'modifyCost') {
      const before = effectiveCost;
      effectiveCost = Math.max(0, effectiveCost + delta);
      if (effectiveCost !== before) {
        appliedModifiers.push({ action, delta, before, after: effectiveCost, effectId: rule.effectId || null });
      }
    } else if (action === 'modifyLevel') {
      const before = effectiveLevel;
      effectiveLevel = Math.max(0, effectiveLevel + delta);
      if (effectiveLevel !== before) {
        appliedModifiers.push({ action, delta, before, after: effectiveLevel, effectId: rule.effectId || null });
      }
    }
  }

  return {
    baseCost,
    baseLevel,
    effectiveCost,
    effectiveLevel,
    appliedModifiers
  };
}

export default {
  evaluateHandPlayRequirements,
  matchesNumericComparison
};
