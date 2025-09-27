/**
 * CardStatCalculator - Common utility for calculating total AP/HP including modifications
 * Extracted from SlotAreaManager.js to enable reuse across the application
 */

export default class CardStatCalculator {
  /**
   * Calculate total AP including modifications (matches Card.js getAPandHPFromCardData logic)
   * @param {Object} fullCardData - The full card data object
   * @returns {number} Total AP value including modifications
   */
  static calculateTotalAP(fullCardData) {
    if (!fullCardData) return 0;
    
    const cardData = fullCardData.cardData || fullCardData;
    
    // For regular cards (unit, pilot, base)
    if (cardData.cardType === 'unit' || cardData.cardType === 'pilot' || cardData.cardType === 'base') {
      if (fullCardData.currentAP != null) {
        // Use currentAP as base and add modifications
        const baseAP = fullCardData.currentAP || 0;
        const modifyAP = fullCardData.modifyAP || 0;
        return baseAP + modifyAP;
      } else {
        // Use original AP from cardData and add modifications
        const baseAP = cardData.ap || 0;
        const modifyAP = fullCardData.modifyAP || 0;
        return baseAP + modifyAP;
      }
    }
    
    // For command cards with pilot_designation effect
    if (cardData.cardType === 'command') {
      const pilotEffect = cardData.effects?.rules?.find(rule => rule.effectId === 'pilot_designation');
      if (pilotEffect && pilotEffect.effect?.parameters) {
        const originalAP = pilotEffect.effect.parameters.AP || 0;
        const baseAP = fullCardData.currentAP || originalAP;
        const modifyAP = fullCardData.modifyAP || 0;
        return baseAP + modifyAP;
      }
    }
    
    return 0;
  }

  /**
   * Calculate total HP including modifications (matches Card.js getAPandHPFromCardData logic)
   * @param {Object} fullCardData - The full card data object
   * @returns {number} Total HP value including modifications
   */
  static calculateTotalHP(fullCardData) {
    if (!fullCardData) return 0;
    
    const cardData = fullCardData.cardData || fullCardData;
    
    // For regular cards (unit, pilot, base)
    if (cardData.cardType === 'unit' || cardData.cardType === 'pilot' || cardData.cardType === 'base') {
      if (fullCardData.currentHP != null) {
        // Use currentHP as base and add modifications
        const baseHP = fullCardData.currentHP || 0;
        const modifyHP = fullCardData.modifyHP || 0;
        return baseHP + modifyHP;
      } else {
        // Use original HP from cardData and add modifications
        const baseHP = cardData.hp || 0;
        const modifyHP = fullCardData.modifyHP || 0;
        return baseHP + modifyHP;
      }
    }
    
    // For command cards with pilot_designation effect
    if (cardData.cardType === 'command') {
      const pilotEffect = cardData.effects?.rules?.find(rule => rule.effectId === 'pilot_designation');
      if (pilotEffect && pilotEffect.effect?.parameters) {
        const originalHP = pilotEffect.effect.parameters.HP || 0;
        const baseHP = fullCardData.currentHP || originalHP;
        const modifyHP = fullCardData.modifyHP || 0;
        return baseHP + modifyHP;
      }
    }
    
    return 0;
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
      const fieldValueData = unitFullData || unitCardData;
      const totalAP = fieldValueData.fieldCardValue?.totalCurrentAP + 
      fieldValueData.fieldCardValue?.totalContinueModifyAP + 
      fieldValueData.fieldCardValue?.totalTempModifyAP;
      const totalHP = fieldValueData.fieldCardValue?.totalCurrentHP + 
      fieldValueData.fieldCardValue?.totalContinueModifyHP + 
      fieldValueData.fieldCardValue?.totalTempModifyHP;
      return { totalAP, totalHP };

    } else if (unitCard && unitFullData?.carduid && unitCard.gameStateManager?.getGameState) {
      const carduid = unitFullData.carduid;
      const gameState = unitCard.gameStateManager.getGameState();
      const players = gameState?.gameEnv?.players || {};
      const slotNames = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
      let slotLogged = false;

      for (const [playerId, player] of Object.entries(players)) {
        if (slotLogged) break;
        const zones = player?.zones;
        if (!zones) continue;

        for (const slotName of slotNames) {
          const slot = zones[slotName];
          if (!slot) continue;

          if (slot.unit?.carduid === carduid || slot.pilot?.carduid === carduid) {
            console.log(`[CardStatCalculator] Found card ${carduid} in ${playerId} ${slotName}:`, slot);
            slotLogged = true;

            const fieldValueData = slot;
            const totalAP = fieldValueData.fieldCardValue?.totalCurrentAP + 
            fieldValueData.fieldCardValue?.totalContinueModifyAP + 
            fieldValueData.fieldCardValue?.totalTempModifyAP;
            const totalHP = fieldValueData.fieldCardValue?.totalCurrentHP + 
            fieldValueData.fieldCardValue?.totalContinueModifyHP + 
            fieldValueData.fieldCardValue?.totalTempModifyHP;
            return { totalAP, totalHP };
          }
        }
      }

      if (!slotLogged) {
        console.log(`[CardStatCalculator] Slot not found for card ${carduid}`);
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
    let totalAP = 0;
    let totalHP = 0;
    
    // Add unit stats if present
    if (slotData.unit) {
      const unitAP = this.calculateTotalAP(slotData.unit);
      const unitHP = this.calculateTotalHP(slotData.unit);
      totalAP += unitAP;
      totalHP += unitHP;
    }
    
    // Add pilot stats if present
    if (slotData.pilot) {
      const pilotAP = this.calculateTotalAP(slotData.pilot);
      const pilotHP = this.calculateTotalHP(slotData.pilot);
      totalAP += pilotAP;
      totalHP += pilotHP;
    }
    
    return { totalAP, totalHP };
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
