import { normalizeFieldCardValue, getTotalsFromCardData } from './FieldValueUtils.js';

function getOriginalStatsFromData(cardData) {
  if (!cardData) {
    return { originalAP: 0, originalHP: 0 };
  }

  const nested = cardData.cardData || {};
  let originalAP = cardData.originalAP ?? nested.originalAP ?? nested.ap ?? 0;
  let originalHP = cardData.originalHP ?? nested.originalHP ?? nested.hp ?? 0;

  if (nested.cardType === 'command') {
    const rules = nested.effects?.rules || [];
    const designateRule = rules.find(rule => {
      const action = rule.action || rule.effect?.action;
      return action === 'designate_pilot';
    });
    const params = designateRule?.parameters || designateRule?.effect?.parameters;
    if (params) {
      if (typeof params.AP === 'number') {
        originalAP = params.AP;
      }
      if (typeof params.HP === 'number') {
        originalHP = params.HP;
      }
    }
  }

  return { originalAP, originalHP };
}

export function buildSlotTotalsField(slotFieldValue, unitData, pilotData) {
  const slotRested = (slotFieldValue && slotFieldValue.isRested !== undefined)
    ? !!slotFieldValue.isRested
    : Boolean(unitData?.isRested || pilotData?.isRested);

  if (!slotFieldValue && !unitData && !pilotData) {
    return { field: null, totalAP: 0, totalHP: 0 };
  }

  const normalizedSlot = normalizeFieldCardValue(slotFieldValue);
  if (normalizedSlot) {
    return {
      field: {
        ...normalizedSlot,
        isRested: normalizedSlot.isRested === null ? slotRested : normalizedSlot.isRested
      },
      totalAP: normalizedSlot.totalAP ?? 0,
      totalHP: normalizedSlot.totalHP ?? 0
    };
  }
  const fallbackField = normalizeFieldCardValue({
    totalOriginalAP: 0,
    totalOriginalHP: 0,
    totalTempModifyAP: 0,
    totalTempModifyHP: 0,
    totalContinueModifyAP: 0,
    totalContinueModifyHP: 0,
    totalDamageReceived: 0,
    totalAP:  0,
    totalHP:  0,
    isRested: false
  });

  return {
    field: fallbackField,
    totalAP: totals.totalAP ?? 0,
    totalHP: totals.totalHP ?? 0
  };
}

function assignCardFieldValues(card, cardData, slotTotals, useSlotTotals) {
  if (!card?.setFieldCardValue) {
    return;
  }

  card.setFieldCardValue(cardData.fieldCardValue || null, { source: 'card', updateOverlay: false });
  const slotValue = useSlotTotals ? slotTotals : null;
  card.setFieldCardValue(slotValue, { source: 'slot', updateOverlay: false });
}

function setCardBaseStats(card, cardData) {
  const baseStats = getOriginalStatsFromData(cardData);
  if (card?.powerOverlay?.setBaseStats) {
    card.powerOverlay.setBaseStats(baseStats.originalAP, baseStats.originalHP);
  }
  return baseStats;
}

function resolveCardTotals({ card, cardData, slotTotals, useSlotTotals, baseStats }) {
  const totals = {
    totalAP: baseStats.originalAP,
    totalHP: baseStats.originalHP,
    isRested: Boolean(cardData?.isRested)
  };

  if (useSlotTotals && slotTotals) {
    totals.totalAP = slotTotals.totalAP ?? totals.totalAP;
    totals.totalHP = slotTotals.totalHP ?? totals.totalHP;
    if (slotTotals.isRested !== undefined && slotTotals.isRested !== null) {
      totals.isRested = !!slotTotals.isRested;
    }
    return totals;
  }

  const fallbackTotals = getTotalsFromCardData(cardData);

  if (typeof card?.getAPandHPFromCardData === 'function') {
    const derived = card.getAPandHPFromCardData();
    if (derived) {
      if (typeof derived.ap === 'number') {
        totals.totalAP = derived.ap;
      } else {
        totals.totalAP = fallbackTotals.totalAP;
      }
      if (typeof derived.hp === 'number') {
        totals.totalHP = derived.hp;
      } else {
        totals.totalHP = fallbackTotals.totalHP;
      }
    } else {
      totals.totalAP = fallbackTotals.totalAP;
      totals.totalHP = fallbackTotals.totalHP;
    }
  } else {
    totals.totalAP = fallbackTotals.totalAP;
    totals.totalHP = fallbackTotals.totalHP;
  }

  return totals;
}

function setCardTotalsAndStatus(card, totals, baseStats) {
  if (!card) {
    return;
  }

  const overlay = card.powerOverlay;
  if (!overlay) {
    return;
  }

  if (overlay.setBaseStats && overlay.setCardTotalAPandHP) {
    overlay.setBaseStats(baseStats.originalAP, baseStats.originalHP);
    overlay.setCardTotalAPandHP(totals.totalAP, totals.totalHP);
    if (overlay.setCardStatus) {
      overlay.setCardStatus(totals.isRested);
    }
  } else if (overlay.updateTotalStats) {
    overlay.updateTotalStats(
      totals.totalAP,
      totals.totalHP,
      totals.isRested,
      baseStats.originalAP,
      baseStats.originalHP
    );
  }
}

function collectCardOverlayState(card, cardData, options = {}) {
  if (!card || !cardData) {
    return null;
  }

  const { slotTotals, useSlotTotals } = options;

  assignCardFieldValues(card, cardData, slotTotals, useSlotTotals);
  const baseStats = setCardBaseStats(card, cardData);
  const totals = resolveCardTotals({
    card,
    cardData,
    slotTotals: useSlotTotals ? slotTotals : null,
    useSlotTotals,
    baseStats
  });

  return {
    card,
    baseStats,
    totals
  };
}

// Applies base + total stats to a card and refreshes its overlay without triggering zone rules twice
export function applyOverlayToCard(card, cardData, options = {}) {
  if (!card || !cardData) {
    return null;
  }

  const { slotTotals = null, useSlotTotals = false } = options;
  const state = collectCardOverlayState(card, cardData, {
    slotTotals,
    useSlotTotals
  });

  if (state) {
    setCardTotalsAndStatus(state.card, state.totals, state.baseStats);
    state.card.applyZoneOverlayRules?.();
  }

  return state;
}

// Calculates slot totals, pushes printed stats, and reconciles slot-level overrides for unit/pilot cards
export function applySlotOverlaySet({ unitCard, pilotCard, unitData, pilotData, slotFieldValue }) {
  const hasUnit = !!unitCard && !!unitData;
  const hasPilot = !!pilotCard && !!pilotData;

  if (!hasUnit && !hasPilot) {
    return {
      totalAP: 0,
      totalHP: 0,
      slotTotalsField: null,
      unitShowsTotals: false,
      pilotShowsTotals: false
    };
  }

  const { field: slotTotalsField, totalAP, totalHP } = buildSlotTotalsField(slotFieldValue, unitData, pilotData);

  const pilotShowsTotals = hasPilot;
  const unitShowsTotals = hasUnit && !hasPilot;

  const unitState = hasUnit
    ? collectCardOverlayState(unitCard, unitData, {
        slotTotals: unitShowsTotals ? slotTotalsField : null,
        useSlotTotals: unitShowsTotals
      })
    : null;

  const pilotState = hasPilot
    ? collectCardOverlayState(pilotCard, pilotData, {
        slotTotals: pilotShowsTotals ? slotTotalsField : null,
        useSlotTotals: pilotShowsTotals
      })
    : null;

  return {
    totalAP,
    totalHP,
    slotTotalsField,
    unitShowsTotals,
    pilotShowsTotals,
    unitState,
    pilotState
  };
}

// Applies the "only one totals label" rule across unit/pilot, respecting optional overrides
export function applySlotTotalsVisibility(unitCard, pilotCard, options = {}) {
  const hasUnit = !!unitCard;
  const hasPilot = !!pilotCard;

  const unitVisible = options.unitShowsTotals ?? (hasUnit && !hasPilot);
  const pilotVisible = options.pilotShowsTotals ?? hasPilot;
  const zone = options.zone ?? null;

  if (unitCard?.clearOverlayOverrides && unitCard?.setOverlayOverrides) {
    unitCard.clearOverlayOverrides(false);
    unitCard.setOverlayOverrides({
      totalsVisible: !!unitVisible,
      totalsZoneOverride: unitVisible ? zone : null
    }, { apply: false });
    unitCard.applyZoneOverlayRules?.();
  }

  if (pilotCard?.clearOverlayOverrides && pilotCard?.setOverlayOverrides) {
    pilotCard.clearOverlayOverrides(false);
    pilotCard.setOverlayOverrides({
      totalsVisible: !!pilotVisible,
      totalsZoneOverride: pilotVisible ? zone : null
    }, { apply: false });
    pilotCard.applyZoneOverlayRules?.();
  }
}

export function finalizeSlotOverlayState(slotState) {
  if (!slotState) {
    return;
  }

  if (slotState.unitState) {
    setCardTotalsAndStatus(slotState.unitState.card, slotState.unitState.totals, slotState.unitState.baseStats);
    slotState.unitState.card.applyZoneOverlayRules?.();
  }

  if (slotState.pilotState) {
    setCardTotalsAndStatus(slotState.pilotState.card, slotState.pilotState.totals, slotState.pilotState.baseStats);
    slotState.pilotState.card.applyZoneOverlayRules?.();
  }
}

export function buildSingleCardTotals(cardData) {
  if (!cardData) {
    return null;
  }

  const normalized = normalizeFieldCardValue(cardData.fieldCardValue);
  if (normalized) {
    return normalized;
  }

  const totals = getTotalsFromCardData(cardData);

  return normalizeFieldCardValue({
    totalOriginalAP: 0,
    totalOriginalHP: 0,
    totalTempModifyAP: 0,
    totalTempModifyHP: 0,
    totalContinueModifyAP: 0,
    totalContinueModifyHP: 0,
    totalDamageReceived: 0,
    totalAP: totals.totalAP ?? 0,
    totalHP: totals.totalHP ?? 0,
    isRested: cardData?.isRested
  });
}
