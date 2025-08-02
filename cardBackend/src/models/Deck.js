// src/models/Deck.js

/**
 * Represents a single deck configuration with clear field mapping
 */
class Deck {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.cards = Array.isArray(data.cards) ? [...data.cards] : [];
        this.leader = Array.isArray(data.leader) ? [...data.leader] : [];
        this.maxCards = data.maxCards || 30;
        this.minCards = data.minCards || 20;
        
        // Runtime properties for gameplay
        this.cardUID = [];
        this.leaderUID = [];
    }

    /**
     * Validate deck structure and requirements
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        if (!this.id) {
            errors.push('Deck ID is required');
        }
        
        if (!this.name) {
            errors.push('Deck name is required');
        }
        
        if (this.cards.length < this.minCards) {
            errors.push(`Deck must have at least ${this.minCards} cards, has ${this.cards.length}`);
        }
        
        if (this.cards.length > this.maxCards) {
            errors.push(`Deck cannot have more than ${this.maxCards} cards, has ${this.cards.length}`);
        }
        
        if (this.leader.length === 0) {
            errors.push('Deck must have at least one leader card');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get deck statistics
     * @returns {Object} Statistics about the deck composition
     */
    getStats() {
        return {
            id: this.id,
            name: this.name,
            totalCards: this.cards.length,
            totalLeaders: this.leader.length,
            cardTypes: {
                character: this.cards.filter(id => id.startsWith('c-')).length,
                help: this.cards.filter(id => id.startsWith('h-')).length,
                special: this.cards.filter(id => id.startsWith('sp-')).length
            }
        };
    }

    /**
     * Generate unique IDs for cards (for gameplay)
     * @returns {Object} Generated UID mappings
     */
    generateCardUIDs() {
        this.cardUID = [];
        this.leaderUID = [];
        
        const deckUIDMapping = {};
        const leaderUIMapping = {};
        
        // Generate card UIDs
        this.cards.forEach((cardId, index) => {
            const uid = `cardId_${index}`;
            deckUIDMapping[uid] = cardId;
            this.cardUID.push(uid);
        });
        
        // Generate leader UIDs  
        this.leader.forEach((leaderId, index) => {
            const uid = `leaderId_${index}`;
            leaderUIMapping[uid] = leaderId;
            this.leaderUID.push(uid);
        });
        
        return {
            deckUIDMapping,
            leaderUIMapping
        };
    }

    /**
     * Create a copy of the deck for modification
     * @returns {Deck} New deck instance with copied data
     */
    clone() {
        return new Deck({
            id: this.id,
            name: this.name,
            cards: [...this.cards],
            leader: [...this.leader],
            maxCards: this.maxCards,
            minCards: this.minCards
        });
    }

    /**
     * Convert deck to JSON format for storage
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            cards: [...this.cards],
            leader: [...this.leader],
            maxCards: this.maxCards,
            minCards: this.minCards
        };
    }

    /**
     * Create Deck instance from JSON data
     * @param {Object} jsonData - Plain object data
     * @returns {Deck} New Deck instance
     */
    static fromJSON(jsonData) {
        return new Deck(jsonData);
    }
}

module.exports = Deck;