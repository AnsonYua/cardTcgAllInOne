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
      const designateRule = rules.find(rule => rule.action === 'designate_pilot');
      const params = designateRule?.parameters;
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
    return null
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
    totals.totalAP = fallbackTotals.totalAP;
    totals.totalHP = fallbackTotals.totalHP;
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

    if (unitCard) {
      this.applyTotalsVisibilityToCard(unitCard, {
        visible: !!unitVisible,
        zone
      });
    }

    if (pilotCard) {
      this.applyTotalsVisibilityToCard(pilotCard, {
        visible: !!pilotVisible,
        zone
      });
    }
  }

  static finalizeSlotOverlayState(slotState) {
    if (!slotState) {
      return;
    }

    if (slotState.unitState) {
      this.setCardTotalsAndStatus(slotState.unitState.card, slotState.unitState.totals, slotState.unitState.baseStats);
    }

    if (slotState.pilotState) {
      this.setCardTotalsAndStatus(slotState.pilotState.card, slotState.pilotState.totals, slotState.pilotState.baseStats);
    }
  }

  static applyTotalsVisibilityToCard(card, { visible, zone }) {
    if (!card?.powerOverlay) {
      return;
    }

    const zoneType = zone ?? card.zoneContext?.zoneType ?? null;
    const targetZone = visible ? (zoneType || 'slot1') : 'hand';

    if (card.powerOverlay && card.powerOverlay.setTotalLabelsVisibility) {
      card.powerOverlay.setTotalLabelsVisibility(targetZone);
    }

    const overlayVisible = card.shouldShowOverlayForZone
      ? card.shouldShowOverlayForZone(zoneType)
      : true;

    if (card.powerOverlay && card.powerOverlay.setOverlayVisible) {
      card.powerOverlay.setOverlayVisible(overlayVisible);
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
