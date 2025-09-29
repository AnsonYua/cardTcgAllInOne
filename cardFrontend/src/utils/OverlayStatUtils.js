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

  const unitTotals = getTotalsFromCardData(unitData);
  const pilotTotals = getTotalsFromCardData(pilotData);

  const combinedOriginalAP = (unitData?.originalAP ?? unitData?.cardData?.ap ?? 0)
    + (pilotData?.originalAP ?? pilotData?.cardData?.ap ?? 0);
  const combinedOriginalHP = (unitData?.originalHP ?? unitData?.cardData?.hp ?? 0)
    + (pilotData?.originalHP ?? pilotData?.cardData?.hp ?? 0);

  const totalAP = (unitTotals?.totalAP ?? 0) + (pilotTotals?.totalAP ?? 0);
  const totalHP = (unitTotals?.totalHP ?? 0) + (pilotTotals?.totalHP ?? 0);

  const fallbackField = normalizeFieldCardValue({
    totalOriginalAP: combinedOriginalAP,
    totalOriginalHP: combinedOriginalHP,
    totalTempModifyAP: 0,
    totalTempModifyHP: 0,
    totalContinueModifyAP: 0,
    totalContinueModifyHP: 0,
    totalDamageReceived: 0,
    totalAP,
    totalHP,
    isRested: slotRested
  });

  return {
    field: fallbackField,
    totalAP,
    totalHP
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

export function setCardTotalsAndStatus(card, totals, baseStats) {
  if (!card) {
    return;
  }

  const overlay = card.powerOverlay;
  if (!overlay) {
    return;
  }
  if (overlay.setBaseStats) {
    overlay.setBaseStats(baseStats.originalAP, baseStats.originalHP);
  }
  if (overlay.setCardTotalAPandHP) {
    overlay.setCardTotalAPandHP(totals.totalAP, totals.totalHP);
  }
  if (overlay.setCardStatus) {
    overlay.setCardStatus(totals.isRested);
  }
}

export function collectCardOverlayState(card, cardData, options = {}) {
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

export default {
  buildSlotTotalsField,
  collectCardOverlayState,
  setCardTotalsAndStatus,
  applyOverlayToCard
};
