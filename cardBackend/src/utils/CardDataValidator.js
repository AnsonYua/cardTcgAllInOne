/**
 * CardDataValidator - Centralized card data validation and extraction
 * Eliminates repeated validation patterns from mozGamePlay.js
 */

const CardInfoUtils = require('../services/CardInfoUtils');

class CardDataValidator {
    /**
     * Validate cardDetails array structure (used 6+ times in original code)
     * @param {Object} cardObj - Card object to validate
     * @returns {boolean} True if cardDetails is valid
     */
    static hasValidCardDetails(cardObj) {
        return cardObj && 
               cardObj.cardDetails && 
               Array.isArray(cardObj.cardDetails) && 
               cardObj.cardDetails.length > 0;
    }

    /**
     * Validate isBack array structure (used multiple times in original code)  
     * @param {Object} cardObj - Card object to validate
     * @returns {boolean} True if isBack is valid
     */
    static hasValidIsBack(cardObj) {
        return cardObj && 
               cardObj.isBack && 
               Array.isArray(cardObj.isBack) && 
               cardObj.isBack.length > 0;
    }

    /**
     * Check if card is face down with proper validation
     * @param {Object} cardObj - Card object to check
     * @returns {boolean} True if card is face down
     */
    static isFaceDown(cardObj) {
        if (!this.hasValidIsBack(cardObj)) {
            return false;
        }
        // Handle both boolean and string values
        const faceDownValue = cardObj.isBack[0];
        return faceDownValue === true || faceDownValue === 'true';
    }

    /**
     * Extract card data from cardObj with multiple fallback strategies
     * Consolidates the getCardData logic from original code
     * @param {Object} cardObj - Card object
     * @returns {Object|null} Card data or null if not found
     */
    static extractCardData(cardObj) {
        if (!cardObj) return null;

        // Strategy 1: Direct card data (new unified format)
        if (cardObj.id && cardObj.cardType) {
            return cardObj;
        }

        // Strategy 2: cardDetails array (legacy format)
        if (this.hasValidCardDetails(cardObj)) {
            return cardObj.cardDetails[0];
        }

        // Strategy 3: card array (old format)
        if (cardObj.card && Array.isArray(cardObj.card) && cardObj.card.length > 0) {
            const cardId = cardObj.card[0];
            // Extract base card ID from UID if needed
            const baseCardId = cardId.includes('_') ? cardId.split('_')[0] : cardId;
            return CardInfoUtils.getCardById(baseCardId);
        }

        return null;
    }

    /**
     * Extract card ID from cardUID (handles UID format)
     * Consolidates the repeated UID parsing pattern
     * @param {string} cardUID - Card UID (e.g., "c-1_1754551822157_24")
     * @returns {string} Base card ID (e.g., "c-1")
     */
    static extractCardIdFromUID(cardUID) {
        if (!cardUID || typeof cardUID !== 'string') {
            return null;
        }
        return cardUID.split('_')[0];
    }

    /**
     * Validate zone contains cards (used 5+ times in original code)
     * @param {Array|Object} zone - Zone to validate
     * @returns {boolean} True if zone has cards
     */
    static zoneHasCards(zone) {
        return zone && Array.isArray(zone) && zone.length > 0;
    }

    /**
     * Validate card has effects and rules
     * @param {Object} cardData - Card data to validate
     * @returns {boolean} True if card has valid effects structure
     */
    static hasValidEffects(cardData) {
        return cardData && 
               cardData.effects && 
               cardData.effects.rules && 
               Array.isArray(cardData.effects.rules) &&
               cardData.effects.rules.length > 0;
    }

    /**
     * Validate rule conditions structure
     * @param {Object} rule - Rule to validate
     * @returns {boolean} True if rule has valid trigger conditions
     */
    static hasValidRuleConditions(rule) {
        return rule && 
               rule.trigger && 
               rule.trigger.conditions && 
               Array.isArray(rule.trigger.conditions);
    }

    /**
     * Extract card name from cardObj with fallback strategies
     * @param {Object} cardObj - Card object
     * @returns {string|null} Card name or null
     */
    static extractCardName(cardObj) {
        const cardData = this.extractCardData(cardObj);
        return cardData?.name || cardData?.id || null;
    }

    /**
     * Extract card power from cardObj with fallback strategies
     * @param {Object} cardObj - Card object  
     * @returns {number} Card power value or 0
     */
    static extractCardPower(cardObj) {
        const cardData = this.extractCardData(cardObj);
        return cardData?.power || cardData?.value || 0;
    }

    /**
     * Extract card type from cardObj with fallback strategies
     * @param {Object} cardObj - Card object
     * @returns {string|null} Card type or null
     */
    static extractCardType(cardObj) {
        const cardData = this.extractCardData(cardObj);
        return cardData?.cardType || cardData?.type || null;
    }

    /**
     * Extract card traits from cardObj with fallback strategies
     * @param {Object} cardObj - Card object
     * @returns {Array} Card traits array (empty if none)
     */
    static extractCardTraits(cardObj) {
        const cardData = this.extractCardData(cardObj);
        return cardData?.traits || cardData?.attribute || [];
    }

    /**
     * Check if card matches specific filters
     * @param {Object} cardObj - Card object to check
     * @param {Array} filters - Array of filter objects
     * @returns {boolean} True if card matches all filters
     */
    static matchesFilters(cardObj, filters) {
        if (!filters || filters.length === 0) return true;

        const cardData = this.extractCardData(cardObj);
        if (!cardData) return false;

        for (const filter of filters) {
            if (filter.type === 'hasTrait') {
                const traits = this.extractCardTraits(cardObj);
                if (!traits.includes(filter.value)) return false;
            } else if (filter.type === 'hasGameType') {
                const gameType = cardData.gameType;
                if (Array.isArray(filter.value)) {
                    if (!filter.value.includes(gameType)) return false;
                } else {
                    if (gameType !== filter.value) return false;
                }
            }
            // Add more filter types as needed
        }

        return true;
    }

    /**
     * Comprehensive card object validation
     * @param {Object} cardObj - Card object to validate
     * @returns {Object} Validation result with details
     */
    static validateCard(cardObj) {
        return {
            isValid: cardObj && (this.hasValidCardDetails(cardObj) || (cardObj.id && cardObj.cardType)),
            hasCardDetails: this.hasValidCardDetails(cardObj),
            hasIsBack: this.hasValidIsBack(cardObj),
            isFaceDown: this.isFaceDown(cardObj),
            cardData: this.extractCardData(cardObj)
        };
    }
}

module.exports = CardDataValidator;