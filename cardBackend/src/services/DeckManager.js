// src/services/DeckManager.js
const fs = require('fs');
const path = require('path');

class DeckManager {
    constructor() {
        this.cardsPath = path.join(__dirname, '../data/characterCards.json');
        this.leaderCardPath = path.join(__dirname, '../data/leaderCards.json');
        this.decksPath = path.join(__dirname, '../data/decks.json');
        this.spCardPath = path.join(__dirname, '../data/utilityCards.json');
        
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

            // Parse all JSON data
            const characterCards = JSON.parse(cardsData);
            const leaderCards = JSON.parse(leaderCardsData);
            const utilityCards = JSON.parse(utilityCardsData);
            this.decks = JSON.parse(decksData);
            
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
            
        } catch (error) {
            console.error('Error initializing DeckManager synchronously:', error);
            // Initialize with empty structure to prevent null errors
            this.cards = { cards: {} };
            this.leaderCards = { leaders: {} };
            this.decks = { playerDecks: {} };
            throw error;
        }
    }

    async getPlayerDecks(playerId) {
        const playerData = this.decks.playerDecks[playerId];
        return playerData;
    }
    getLeaderCards(cardId){
        const leaderCards = this.leaderCards.leaders[cardId];
        return leaderCards;
    }


    async saveDecks() {
        const fs = require('fs').promises;
        await fs.writeFile(this.decksPath, JSON.stringify(this.decks, null, 2));
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

    /**
     * Check if DeckManager is properly initialized
     * @returns {boolean} - True if initialized, false otherwise
     */
    isInitialized() {
        return !!(this.cards && this.cards.cards && this.leaderCards && this.decks);
    }

    /**
     * Get initialization status for debugging
     * @returns {Object} - Status object with details
     */
    getInitializationStatus() {
        return {
            initialized: this.isInitialized(),
            cardsLoaded: !!(this.cards && this.cards.cards),
            cardsCount: this.cards?.cards ? Object.keys(this.cards.cards).length : 0,
            leaderCardsLoaded: !!this.leaderCards,
            decksLoaded: !!this.decks
        };
    }
}

module.exports = new DeckManager();