const { setupTestGame, makePostRequest } = require('./testHelpers');

describe('Game Setup Tests', () => {
    let gameId;
    let startGameResp;
    let p1_startReadyResp;
    let p2_startReadyResp;
    let cardsData;
    let summonerCards;
    let decksData;

    beforeAll(async () => {
        // Load test data
        [cardsData, summonerCards, decksData] = await Promise.all([
            require('../data/characterCards.json'),
            require('../data/utilityCards.json'),
            require('../data/decks.json')
        ]);
    });

    beforeEach(async () => {
        // Start a new game before each test
        startGameResp = await setupTestGame();
        gameId = startGameResp.gameId;

        // Both players ready
        p1_startReadyResp = await makePostRequest(
            '/player/startReady',
            {
                gameId: gameId,
                playerId: "playerId_1",
                redraw: false
            }
        );

        p2_startReadyResp = await makePostRequest(
            '/player/startReady',
            {
                gameId: gameId,
                playerId: "playerId_2",
                redraw: false
            }
        );

        console.log("-----------p2_startReadyResp------------");
        console.log(p2_startReadyResp);
        console.log("--------------------------------");
    });

    describe('Game Initialization', () => {
        it('should set up correct game state', () => {
            // Check game ID
            expect(gameId).toBeDefined();

            // Check summoners
            expect(startGameResp.gameEnv.playerId_1.deck.summoner).toBeDefined();
            expect(startGameResp.gameEnv.playerId_2.deck.summoner).toBeDefined();
        });
    });

    describe('Player Ready State', () => {
        it('should set up correct deck state', () => {
            const gameEnv = p2_startReadyResp.gameEnv;

            console.log("-----------gameEnv------------");
            console.log(gameEnv);
            console.log("--------------------------------");
            //wait 1 second
            // Check first player and current player
            expect(gameEnv.firstPlayer).toBeDefined();
            expect(gameEnv.currentPlayer).toBeDefined();
            if(gameEnv.currentPlayer == "playerId_1"){
                // Check player 1 deck state
                expect(gameEnv.playerId_1.deck.hand).toHaveLength(8);
                expect(gameEnv.playerId_1.deck.mainDeck).toHaveLength(decksData.playerDecks.playerId_1.decks.deck001.cards.length - 8);
                expect(gameEnv.playerId_1.Field.summonner).toBeDefined();

                // Check player 2 deck state
                expect(gameEnv.playerId_2.deck.hand).toHaveLength(7);
                expect(gameEnv.playerId_2.deck.mainDeck).toHaveLength(decksData.playerDecks.playerId_2.decks.deck001.cards.length - 7);
                expect(gameEnv.playerId_2.Field.summonner).toBeDefined();
            }
        });
    });

    describe('Hand Cards Validation', () => {
        it('should be valid and from deck', async () => {
            const gameEnv = p2_startReadyResp.gameEnv;
            const players = ["playerId_1", "playerId_2"];
            console.log("-----------gameEnv------------");
            console.log(gameEnv);
            console.log("--------------------------------");
            // Wait for game state to be ready
            let retries = 0;
            while (!gameEnv.playerId_1?.deck?.hand && retries < 5) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
            }

            players.forEach(playerId => {
                const hand = gameEnv[playerId].deck.hand;
                const mainDeck = gameEnv[playerId].deck.mainDeck;
                const originalDeck = decksData.playerDecks[playerId].decks.deck001.cards;

                // Check if all hand cards are in original deck
                hand.forEach(cardId => {
                    expect(originalDeck).toContain(cardId);
                    expect(cardsData.cards).toHaveProperty(cardId);
                });

                // Check if all main deck cards are in original deck
                mainDeck.forEach(cardId => {
                    expect(originalDeck).toContain(cardId);
                    expect(cardsData.cards).toHaveProperty(cardId);
                });

                // Check total cards
                expect(hand.length + mainDeck.length).toBe(originalDeck.length);
            });
        });
    });
}); 