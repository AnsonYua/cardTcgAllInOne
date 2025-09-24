// HandUtils.js
// Utility functions for hand card operations

/**
 * HandUtils - Centralized utilities for hand card operations
 */
export default class HandUtils {
  
  /**
   * Get card UID from hand for backend API calls
   * Finds the actual UID of a card in the player's hand based on its base card ID
   * 
   * @param {Object} cardData - Card data object containing base card ID
   * @param {GameStateManager} gameStateManager - Game state manager instance
   * @returns {string|null} Card UID or null if not found
   */
  static getCarduidFromHand(cardData, gameStateManager) {
    // Get the current hand from game state to find card UID
    const hand = gameStateManager.getPlayerHand();
    
    // Find the actual UID of this card in the player's hand
    // Backend hand contains UID strings like "c-1_1754551822157_24"
    // Frontend cardData.id is the base ID like "c-1"
    // We need to find the actual UID that matches this base ID
    const carduid = hand.find(handCarduid => {
      // Extract base card ID from UID (before first underscore)
      const baseCardId = typeof handCarduid === 'string' 
        ? handCarduid.split('_')[0] 
        : handCarduid.id;
      return baseCardId === cardData.id;
    });
    
    if (!carduid) {
      console.error(`Card ${cardData.id} not found in player hand`);
      console.log('Available hand cards (UIDs):', hand);
      console.log('Looking for base card ID:', cardData.id);
      return null;
    }
    
    return carduid;
  }
  
  /**
   * Extract base card ID from a card UID
   * Utility function for extracting base card ID from full UID
   * 
   * @param {string} carduid - Full card UID like "c-1_1754551822157_24"
   * @returns {string} Base card ID like "c-1"
   */
  static getBaseCardId(carduid) {
    if (typeof carduid !== 'string') {
      return carduid?.id || carduid;
    }
    return carduid.split('_')[0];
  }
  
  /**
   * Check if a card exists in the player's hand by base ID
   * 
   * @param {string} baseCardId - Base card ID to search for
   * @param {GameStateManager} gameStateManager - Game state manager instance
   * @returns {boolean} True if card exists in hand
   */
  static isCardInHand(baseCardId, gameStateManager) {
    const hand = gameStateManager.getPlayerHand();
    return hand.some(handCarduid => {
      const cardBaseId = this.getBaseCardId(handCarduid);
      return cardBaseId === baseCardId;
    });
  }
  
  /**
   * Get all cards in hand with their UIDs and base IDs
   * Useful for debugging and hand management
   * 
   * @param {GameStateManager} gameStateManager - Game state manager instance
   * @returns {Array} Array of {uid, baseId} objects
   */
  static getHandCardDetails(gameStateManager) {
    const hand = gameStateManager.getPlayerHand();
    return hand.map(carduid => ({
      uid: carduid,
      baseId: this.getBaseCardId(carduid)
    }));
  }
}