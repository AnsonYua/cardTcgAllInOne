"use strict";
// src/services/DeckManager.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DecksCollection_1 = require("../models/DecksCollection");
class DeckManager {
    constructor() {
        // Paths that work both in development (ts-node) and production (compiled)
        const isCompiled = __dirname.includes('dist');
        const basePath = isCompiled ? path.join(__dirname, '../../../src/data') : path.join(__dirname, '../data');
        this.cardsPath = path.join(basePath, 'characterCards.json');
        this.leaderCardPath = path.join(basePath, 'leaderCards.json');
        this.decksPath = path.join(basePath, 'decks.json');
        this.spCardPath = path.join(basePath, 'utilityCards.json');
        // Initialize synchronously in constructor
        this.initializeSync();
    }
    initializeSync() {
        try {
            console.log('Loading DeckManager synchronously...');
            // Read all files synchronously
            const cardsData = fs.readFileSync(this.cardsPath, 'utf8');
            const leaderCardsData = fs.readFileSync(this.leaderCardPath, 'utf8');
            const decksData = fs.readFileSync(this.decksPath, 'utf8');
            const utilityCardsData = fs.readFileSync(this.spCardPath, 'utf8');
            // Parse all JSON data with type safety
            const characterCards = JSON.parse(cardsData);
            const leaderCards = JSON.parse(leaderCardsData);
            const utilityCards = JSON.parse(utilityCardsData);
            const decksRawData = JSON.parse(decksData);
            // Create DecksCollection instance (object-oriented approach)
            this.decksCollection = DecksCollection_1.DecksCollection.fromJSON(decksRawData);
            // Maintain backward compatibility with old this.decks access
            this.decks = decksRawData;
            // Store separate collections for specific access
            this.leaderCards = leaderCards;
            // Initialize combined cards collection
            this.cards = { cards: {} };
            // Merge all card types into unified collection
            if (characterCards && characterCards.cards) {
                this.cards.cards = { ...this.cards.cards, ...characterCards.cards };
            }
            if (leaderCards && leaderCards.leaders) {
                this.cards.cards = { ...this.cards.cards, ...leaderCards.leaders };
            }
            if (utilityCards && utilityCards.cards) {
                this.cards.cards = { ...this.cards.cards, ...utilityCards.cards };
            }
            // Add metadata if available
            if (characterCards.combos) {
                this.cards.combos = characterCards.combos;
            }
            console.log(`DeckManager initialized synchronously with ${Object.keys(this.cards.cards).length} total cards`);
            console.log(`DecksCollection loaded with ${this.decksCollection.getAllPlayerIds().length} players`);
        }
        catch (error) {
            console.error('Error initializing DeckManager synchronously:', error);
            // Initialize with empty structure to prevent null errors
            this.cards = { cards: {} };
            this.leaderCards = { leaders: {} };
            this.decks = { playerDecks: {} };
            this.decksCollection = new DecksCollection_1.DecksCollection();
            throw error;
        }
    }
    async getPlayerDecks(playerId) {
        // Use object-oriented approach
        const playerDeckCollection = this.decksCollection.getPlayerDecks(playerId);
        if (!playerDeckCollection) {
            throw new Error('Player Deck not found');
        }
        // Generate UIDs for active deck (for gameplay compatibility)
        const uidMappings = playerDeckCollection.generateActiveDecksUIDs();
        // Return data in format compatible with existing API
        const playerData = playerDeckCollection.toJSON();
        // Add the generated UIDs to the active deck for compatibility
        const activeDeck = playerDeckCollection.getActiveDeck();
        if (activeDeck && playerData.decks[playerData.activeDeck]) {
            playerData.decks[playerData.activeDeck].cardUID = uidMappings.cardUID;
            playerData.decks[playerData.activeDeck].leaderUID = uidMappings.leaderUID;
        }
        return playerData;
    }
    getLeaderCards(cardId) {
        const leaderCards = this.leaderCards.leaders[cardId];
        return leaderCards;
    }
    async saveDecks() {
        const fsPromises = fs.promises;
        // Use object-oriented approach - save from DecksCollection
        const dataToSave = this.decksCollection.toJSON();
        await fsPromises.writeFile(this.decksPath, JSON.stringify(dataToSave, null, 2));
        // Update backward compatibility reference
        this.decks = dataToSave;
    }
    getCardDetails(cardId) {
        const cardDetails = this.cards.cards[cardId];
        if (!cardDetails) {
            console.warn(`Card not found: ${cardId}. Available cards:`, Object.keys(this.cards.cards).slice(0, 10));
        }
        return cardDetails;
    }
    async drawCards(playerId, count = 1) {
        const playerData = await this.getPlayerDecks(playerId);
        const activeDeck = playerData.decks[playerData.activeDeck];
        if (!activeDeck) {
            throw new Error('No active deck found');
        }
        // Simulate drawing cards
        const drawnCards = [];
        const remainingCards = [...activeDeck.cards];
        for (let i = 0; i < count && remainingCards.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * remainingCards.length);
            const cardId = remainingCards.splice(randomIndex, 1)[0];
            drawnCards.push(this.getCardDetails(cardId));
        }
        return drawnCards;
    }
    // ============ NEW OBJECT-ORIENTED METHODS ============
    /**
     * Get DecksCollection instance for object-oriented access
     * @returns The decks collection instance
     */
    getDecksCollection() {
        return this.decksCollection;
    }
    /**
     * Get a specific player's deck collection
     * @param playerId - Player ID
     * @returns Player deck collection or null
     */
    getPlayerDeckCollection(playerId) {
        return this.decksCollection.getPlayerDecks(playerId);
    }
    /**
     * Get collection statistics
     * @returns Statistics about decks and players
     */
    getDecksStats() {
        return this.decksCollection.getStats();
    }
    /**
     * Validate entire deck collection
     * @returns Validation result with isValid boolean and errors array
     */
    validateDecksCollection() {
        return this.decksCollection.validate();
    }
    // ============ LEGACY COMPATIBILITY METHODS ============
    /**
     * Check if DeckManager is properly initialized
     * @returns True if initialized, false otherwise
     */
    isInitialized() {
        return !!(this.cards && this.cards.cards && this.leaderCards && this.decks && this.decksCollection);
    }
    /**
     * Get initialization status for debugging
     * @returns Status object with details
     */
    getInitializationStatus() {
        return {
            initialized: this.isInitialized(),
            cardsLoaded: !!(this.cards && this.cards.cards),
            cardsCount: this.cards?.cards ? Object.keys(this.cards.cards).length : 0,
            leaderCardsLoaded: !!this.leaderCards,
            decksLoaded: !!this.decks,
            decksCollectionLoaded: !!this.decksCollection,
            playersCount: this.decksCollection ? this.decksCollection.getAllPlayerIds().length : 0
        };
    }
}
// Export singleton instance
exports.default = new DeckManager();
//# sourceMappingURL=DeckManager.js.map