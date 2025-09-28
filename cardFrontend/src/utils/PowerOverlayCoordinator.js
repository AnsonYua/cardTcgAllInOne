import { normalizeFieldCardValue } from './FieldValueUtils.js';
import CardStatCalculator from './CardStatCalculator.js';

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

  const totals = CardStatCalculator.calculateSlotDataTotals({
    fieldCardValue: slotFieldValue,
    unit: unitData || null,
    pilot: pilotData || null
  });

  const fallbackField = normalizeFieldCardValue({
    totalOriginalAP: 0,
    totalOriginalHP: 0,
    totalTempModifyAP: 0,
    totalTempModifyHP: 0,
    totalContinueModifyAP: 0,
    totalContinueModifyHP: 0,
    totalDamageReceived: 0,
    totalAP: totals.totalAP ?? 0,
    totalHP: totals.totalHP ?? 0,
    isRested: slotRested
  });

  return {
    field: fallbackField,
    totalAP: totals.totalAP ?? 0,
    totalHP: totals.totalHP ?? 0
  };
}

export function applyOverlayToCard(card, cardData, options = {}) {
  if (!card || !cardData) {
    return;
  }

  const { slotTotals = null, useSlotTotals = false } = options;

  if (card.setFieldCardValue) {
    card.setFieldCardValue(cardData.fieldCardValue || null, { source: 'card', updateOverlay: false });
    const slotValue = useSlotTotals ? slotTotals : null;
    card.setFieldCardValue(slotValue, { source: 'slot', updateOverlay: false });
  }

  if (card.refreshOverlayStats) {
    card.refreshOverlayStats(cardData.isRested);
  } else if (card.powerOverlay) {
    const { originalAP, originalHP } = getOriginalStatsFromData(cardData);
    card.powerOverlay.setBaseStats(originalAP, originalHP);
    const totalAP = useSlotTotals && slotTotals ? slotTotals.totalAP ?? originalAP : originalAP;
    const totalHP = useSlotTotals && slotTotals ? slotTotals.totalHP ?? originalHP : originalHP;
    card.powerOverlay.updateTotalStats(totalAP, totalHP, cardData.isRested, originalAP, originalHP);
  }

  card.applyZoneOverlayRules?.();
}

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

  if (hasUnit) {
    applyOverlayToCard(unitCard, unitData, {
      slotTotals: unitShowsTotals ? slotTotalsField : null,
      useSlotTotals: unitShowsTotals
    });
  }

  if (hasPilot) {
    applyOverlayToCard(pilotCard, pilotData, {
      slotTotals: pilotShowsTotals ? slotTotalsField : null,
      useSlotTotals: pilotShowsTotals
    });
  }

  return {
    totalAP,
    totalHP,
    slotTotalsField,
    unitShowsTotals,
    pilotShowsTotals
  };
}

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

export function buildSingleCardTotals(cardData) {
  if (!cardData) {
    return null;
  }

  const normalized = normalizeFieldCardValue(cardData.fieldCardValue);
  if (normalized) {
    return normalized;
  }

  const totals = CardStatCalculator.getTotalApAndHpByCardData(cardData) || {};

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
