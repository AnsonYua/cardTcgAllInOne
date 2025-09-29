import { normalizeFieldCardValue, getTotalsFromCardData } from './FieldValueUtils.js';
import { buildSlotTotalsField, collectCardOverlayState, setCardTotalsAndStatus } from './OverlayStatUtils.js';
export { applyOverlayToCard } from './OverlayStatUtils.js';

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
