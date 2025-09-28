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

