/**
 * CardStatCalculator - Common utility for calculating total AP/HP including modifications
 * Extracted from SlotAreaManager.js to enable reuse across the application
 */

export default class CardStatCalculator {


  static getTotalApAndHpByCardData(cardData) {
    let totalAP = 0;
    let totalHP = 0;
    const isBaseCard = cardData?.cardType === 'base';
    if(isBaseCard){
      const fieldTotals = this._calculateTotalsFromFieldValue((cardData).fieldCardValue);
      if (fieldTotals) {
        return fieldTotals;
      }
    }

    return { totalAP, totalHP };
  }

  
  /**
   * Calculate combined total AP and HP for unit and pilot cards in a slot
   * @param {Object} unitCard - Unit card data (can be null)
   * @param {Object} pilotCard - Pilot card data (optional, can be null)
   * @returns {Object} Combined totals: { totalAP: number, totalHP: number }
   */
  static calculateTotalInSlot(unitCard, pilotCard) {
    const unitFullData = unitCard?.fullCardData || null;
    const unitCardData = unitFullData?.cardData || unitCard?.cardData || null;
    const isBaseCard = unitCardData?.cardType === 'base';

    if (isBaseCard) {
      console.log('[CardStatCalculator] Base card data:', unitFullData || unitCardData);
      const fieldTotals = this._calculateTotalsFromFieldValue((unitFullData || unitCardData).fieldCardValue);
      if (fieldTotals) {
        return fieldTotals;
      }

    } else if (unitCard && unitFullData?.carduid && unitCard.gameStateManager?.getGameState) {
      const totalsFromState = this._findTotalsFromGameState(unitFullData.carduid, unitCard.gameStateManager);
      if (totalsFromState) {
        return totalsFromState;
      }
    }

    let totalAP = 0;
    let totalHP = 0;

    
    return { totalAP, totalHP };
  }

  /**
   * Calculate total AP/HP for slot data (without Card objects)
   * Used by ItemDataResolver for slot card display
   * @param {Object} slotData - Slot data with unit and pilot properties
   * @returns {Object} Combined totals: { totalAP: number, totalHP: number }
   */
  static calculateSlotDataTotals(slotData) {
    const totalsFromSlot = this._calculateTotalsFromSlot(slotData);
    if (totalsFromSlot) {
      return totalsFromSlot;
    }

    return { totalAP: 0, totalHP: 0 };
  }

  static _calculateTotalsFromFieldValue(fieldValue) {
    if (!fieldValue) {
      return null;
    }
    const totalAP = fieldValue?.totalAP || 0

    const totalHP = fieldValue?.totalHP || 0

    return { totalAP, totalHP };
  }

  static _findTotalsFromGameState(carduid, gameStateManager) {
    if (!carduid || !gameStateManager?.getGameState) {
      return null;
    }

    const gameState = gameStateManager.getGameState();
    const players = gameState?.gameEnv?.players || {};
    const slotNames = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];

    for (const [playerId, player] of Object.entries(players)) {
      const zones = player?.zones;
      if (!zones) continue;

      for (const slotName of slotNames) {
        const slot = zones[slotName];
        if (!slot) continue;

        if (slot.unit?.carduid === carduid || slot.pilot?.carduid === carduid) {
          console.log(`[CardStatCalculator] Found card ${carduid} in ${playerId} ${slotName}:`, slot);

          const totals = this._calculateTotalsFromSlot(slot);
          if (totals) {
            return totals;
          }
        }
      }
    }

    console.log(`[CardStatCalculator] Slot not found for card ${carduid}`);
    return null;
  }

  static _calculateTotalsFromSlot(slot) {
    if (!slot) {
      return null;
    }

    const fieldTotals = this._calculateTotalsFromFieldValue(slot.fieldCardValue);
    if (fieldTotals) {
      return fieldTotals;
    }

    let totalAP = 0;
    let totalHP = 0;
    return {totalAP,to}
  }

  /**
   * Get original AP value for a card (handles command cards with pilot_designation)
   * @param {Object} fullCardData - Card data with optional modifiers
   * @returns {number} Original AP value
   */
  static getOriginalAP(fullCardData) {
    if (!fullCardData) return 0;
    
    const cardData = fullCardData.cardData || fullCardData;
    
    // For command cards with pilot_designation effect, extract AP from effect parameters
    if (cardData.cardType === 'command') {
      const pilotEffect = cardData.effects?.rules?.find(rule => rule.effectId === 'pilot_designation');
      if (pilotEffect && pilotEffect.effect?.parameters) {
        return pilotEffect.effect.parameters.AP || 0;
      }
    }
    
    // For regular cards, use base AP from cardData
    return cardData.ap || 0;
  }

  /**
   * Get original HP value for a card (handles command cards with pilot_designation)
   * @param {Object} fullCardData - Card data with optional modifiers
   * @returns {number} Original HP value
   */
  static getOriginalHP(fullCardData) {
    if (!fullCardData) return 0;
    
    const cardData = fullCardData.cardData || fullCardData;
    
    // For command cards with pilot_designation effect, extract HP from effect parameters
    if (cardData.cardType === 'command') {
      const pilotEffect = cardData.effects?.rules?.find(rule => rule.effectId === 'pilot_designation');
      if (pilotEffect && pilotEffect.effect?.parameters) {
        return pilotEffect.effect.parameters.HP || 0;
      }
    }
    
    // For regular cards, use base HP from cardData
    return cardData.hp || 0;
  }
}
