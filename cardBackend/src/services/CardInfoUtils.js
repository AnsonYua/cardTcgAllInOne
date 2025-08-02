const DeckManager = require('./DeckManager');
class CardInfoUtils {
    constructor() {
        this.deckManager = DeckManager;
    }

    getCurrentLeader(gameEnv, playerId){
        // Validate unified structure
        if (!gameEnv.players) {
            throw new Error('Game environment must have unified structure with gameEnv.players');
        }
        
        const playerData = gameEnv.players[playerId];
        if (!playerData) {
            throw new Error(`Player ${playerId} not found in gameEnv.players`);
        }
        
        const deck = playerData.deck;
        const crtLeaderCardUID = deck.leader[deck.currentLeaderIdx];
        const crtLeaderCard = deck.leaderMapping[crtLeaderCardUID];
        return this.deckManager.getLeaderCards(crtLeaderCard);
    }

    getCardDetails(cardId) {
        return this.deckManager.getCardDetails(cardId);
    }
}

module.exports = new CardInfoUtils();