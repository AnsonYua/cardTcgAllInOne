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


    //if it is not base card , use unitCard.carduid and find the slot 
    //and console.log slot
    //if it is base card console.log the card data

    let totalAP = 0;
    let totalHP = 0;

    let totalCurrentAP = 0;
    let totalCurrentHP = 0;
   
    let totalModifyAP = 0;
    let totalModifyHP = 0; 
    console.log("asdadsdsadssdds 1111", JSON.stringify(unitCard.fullCardData))
    // Add unit card stats if unit exists
    if (unitCard && unitCard.fullCardData) {
      const unitCurrentAP = unitCard.fullCardData.currentAP || 0;
      const unitModifyAP = unitCard.fullCardData.modifyAP || 0;
      const unitCurrentHP = unitCard.fullCardData.currentHP || 0;
      const unitModifyHP = unitCard.fullCardData.modifyHP || 0;
      
      totalCurrentAP += unitCurrentAP;
      totalCurrentHP += unitCurrentHP;
      totalModifyAP += unitModifyAP;
      totalModifyHP += unitModifyHP;
      
      console.log(`[CardStatCalculator] Unit contribution: AP=${unitCurrentAP + unitModifyAP} (${unitCurrentAP}+${unitModifyAP}), HP=${unitCurrentHP + unitModifyHP} (${unitCurrentHP}+${unitModifyHP})`);
    }
    
    // Add pilot card stats if pilot exists
    if (pilotCard && pilotCard.fullCardData) {
      const pilotCurrentAP = pilotCard.fullCardData.currentAP || 0;
      const pilotModifyAP = pilotCard.fullCardData.modifyAP || 0;
      const pilotCurrentHP = pilotCard.fullCardData.currentHP || 0;
      const pilotModifyHP = pilotCard.fullCardData.modifyHP || 0;
      
      totalCurrentAP += pilotCurrentAP;
      totalCurrentHP += pilotCurrentHP;
      totalModifyAP += pilotModifyAP;
      totalModifyHP += pilotModifyHP;

      console.log(`[CardStatCalculator] Pilot contribution: AP=${pilotCurrentAP + pilotModifyAP} (${pilotCurrentAP}+${pilotModifyAP}), HP=${pilotCurrentHP + pilotModifyHP} (${pilotCurrentHP}+${pilotModifyHP})`);
    }
    totalAP = totalCurrentAP + totalModifyAP;
    totalHP = totalCurrentHP + totalModifyHP;
    console.log(`[CardStatCalculator] Slot total: AP=${totalAP}, HP=${totalHP}`);
    
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