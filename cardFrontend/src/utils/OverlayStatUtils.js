import { normalizeFieldCardValue, getTotalsFromCardData } from './FieldValueUtils.js';

class OverlayStatUtils {
  static getOriginalStatsFromData(cardData) {
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

  static buildSlotTotalsField(slotFieldValue, unitData, pilotData) {
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

  static assignCardFieldValues(card, cardData, slotTotals, useSlotTotals) {
    if (!card?.setFieldCardValue) {
      return;
    }

    card.setFieldCardValue(cardData.fieldCardValue || null, { source: 'card', updateOverlay: false });
    const slotValue = useSlotTotals ? slotTotals : null;
    card.setFieldCardValue(slotValue, { source: 'slot', updateOverlay: false });
  }

  static setCardBaseStats(card, cardData) {
    const baseStats = this.getOriginalStatsFromData(cardData);
    if (card?.powerOverlay?.setBaseStats) {
      card.powerOverlay.setBaseStats(baseStats.originalAP, baseStats.originalHP);
    }
    return baseStats;
  }

  static resolveCardTotals({ card, cardData, slotTotals, useSlotTotals, baseStats }) {
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
        totals.totalAP = typeof derived.ap === 'number' ? derived.ap : fallbackTotals.totalAP;
        totals.totalHP = typeof derived.hp === 'number' ? derived.hp : fallbackTotals.totalHP;
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

  static setCardTotalsAndStatus(card, totals, baseStats) {
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

  static collectCardOverlayState(card, cardData, options = {}) {
    if (!card || !cardData) {
      return null;
    }

    const { slotTotals, useSlotTotals } = options;

    this.assignCardFieldValues(card, cardData, slotTotals, useSlotTotals);
    const baseStats = this.setCardBaseStats(card, cardData);
    const totals = this.resolveCardTotals({
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

  static applyOverlayToCard(card, cardData, options = {}) {
    if (!card || !cardData) {
      return null;
    }

    const { slotTotals = null, useSlotTotals = false } = options;
    const state = this.collectCardOverlayState(card, cardData, {
      slotTotals,
      useSlotTotals
    });

    if (state) {
      this.setCardTotalsAndStatus(state.card, state.totals, state.baseStats);
      state.card.applyZoneOverlayRules?.();
    }

    return state;
  }

  static applySlotOverlaySet({ unitCard, pilotCard, unitData, pilotData, slotFieldValue }) {
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

    const { field: slotTotalsField, totalAP, totalHP } = this.buildSlotTotalsField(slotFieldValue, unitData, pilotData);

    const pilotShowsTotals = hasPilot;
    const unitShowsTotals = hasUnit && !hasPilot;

    const unitState = hasUnit
      ? this.collectCardOverlayState(unitCard, unitData, {
          slotTotals: unitShowsTotals ? slotTotalsField : null,
          useSlotTotals: unitShowsTotals
        })
      : null;

    const pilotState = hasPilot
      ? this.collectCardOverlayState(pilotCard, pilotData, {
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

  static applySlotTotalsVisibility(unitCard, pilotCard, options = {}) {
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

  static finalizeSlotOverlayState(slotState) {
    if (!slotState) {
      return;
    }

    if (slotState.unitState) {
      this.setCardTotalsAndStatus(slotState.unitState.card, slotState.unitState.totals, slotState.unitState.baseStats);
      slotState.unitState.card.applyZoneOverlayRules?.();
    }

    if (slotState.pilotState) {
      this.setCardTotalsAndStatus(slotState.pilotState.card, slotState.pilotState.totals, slotState.pilotState.baseStats);
      slotState.pilotState.card.applyZoneOverlayRules?.();
    }
  }

  static buildSingleCardTotals(cardData) {
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
}

export default OverlayStatUtils;
