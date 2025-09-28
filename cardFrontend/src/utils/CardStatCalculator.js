import { normalizeFieldCardValue } from './FieldValueUtils.js';

/**
 * CardStatCalculator - Common utility for calculating total AP/HP including modifications.
 * Relies on backend-provided fieldCardValue objects when available.
 */
export default class CardStatCalculator {
  static getTotalApAndHpByCardData(cardData) {
    const normalized = normalizeFieldCardValue(cardData?.fieldCardValue);
    if (normalized) {
      return {
        totalAP: normalized.totalAP,
        totalHP: normalized.totalHP
      };
    }

    return {
      totalAP: cardData?.totalAP ?? cardData?.ap ?? 0,
      totalHP: cardData?.totalHP ?? cardData?.hp ?? 0
    };
  }

  /**
   * Calculate combined total AP/HP for unit + pilot cards currently occupying a slot.
   * Prefers the slot-level fieldCardValue when present.
   */
  static calculateTotalInSlot(unitCard, pilotCard) {
    const slotFieldValue = normalizeFieldCardValue(
      unitCard?.slotFieldCardValue
        || pilotCard?.slotFieldCardValue
        || unitCard?.fullCardData?.fieldCardValue
        || pilotCard?.fullCardData?.fieldCardValue
        || unitCard?.cardData?.fieldCardValue
        || pilotCard?.cardData?.fieldCardValue
    );

    if (slotFieldValue) {
      return {
        totalAP: slotFieldValue.totalAP,
        totalHP: slotFieldValue.totalHP
      };
    }

    const unitTotals = this.getTotalApAndHpByCardData(
      unitCard?.fullCardData ?? unitCard?.cardData ?? unitCard ?? {}
    );
    const pilotTotals = this.getTotalApAndHpByCardData(
      pilotCard?.fullCardData ?? pilotCard?.cardData ?? pilotCard ?? {}
    );

    return {
      totalAP: (unitTotals?.totalAP ?? 0) + (pilotTotals?.totalAP ?? 0),
      totalHP: (unitTotals?.totalHP ?? 0) + (pilotTotals?.totalHP ?? 0)
    };
  }

  /**
   * Calculate total AP/HP from raw slot data (no Card instances).
   */
  static calculateSlotDataTotals(slotData) {
    const slotFieldValue = normalizeFieldCardValue(slotData?.fieldCardValue);
    if (slotFieldValue) {
      return {
        totalAP: slotFieldValue.totalAP,
        totalHP: slotFieldValue.totalHP
      };
    }

    const unitTotals = this.getTotalApAndHpByCardData(slotData?.unit || {});
    const pilotTotals = this.getTotalApAndHpByCardData(slotData?.pilot || {});

    return {
      totalAP: (unitTotals?.totalAP ?? 0) + (pilotTotals?.totalAP ?? 0),
      totalHP: (unitTotals?.totalHP ?? 0) + (pilotTotals?.totalHP ?? 0)
    };
  }
}
