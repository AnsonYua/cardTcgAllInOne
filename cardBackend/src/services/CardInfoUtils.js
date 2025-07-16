const DeckManager = require('./DeckManager');
class CardInfoUtils {
    constructor() {
        this.deckManager = DeckManager;
    }

    getCurrentLeader(gameEnv, playerId){
        const deck = gameEnv[playerId].deck;
        const crtLeaderCard = deck.leader[deck.currentLeaderIdx]
        return this.deckManager.getLeaderCards(crtLeaderCard);
    }

    getCardDetails(cardId) {
        return this.deckManager.getCardDetails(cardId);
    }
}

module.exports = new CardInfoUtils();