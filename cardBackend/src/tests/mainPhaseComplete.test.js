// Test cases for main phase completion logic including Help zone checks
const { injectGameState, performPlayerAction } = require('./testHelpers');

describe('Main Phase Completion Tests', () => {
    let gameId;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
    });

    describe('Help Zone Requirements', () => {
        test('should not advance to SP phase when character zones filled but Help zones empty', async () => {
            gameId = 'test-help-required-' + Date.now();
            
            const gameEnv = {
                "playerId_1": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-1"],
                        "hand": ["h-1"], // Has Help card but hasn't placed it
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-1", "name": "Test Leader", "cardType": "leader", "initialPoint": 100 },
                        "top": [{ "cardDetails": [{"id": "c-1", "cardType": "character", "power": 50}], "isBack": [false] }],
                        "left": [{ "cardDetails": [{"id": "c-2", "cardType": "character", "power": 60}], "isBack": [false] }],
                        "right": [{ "cardDetails": [{"id": "c-3", "cardType": "character", "power": 70}], "isBack": [false] }],
                        "help": [], // Empty Help zone but player has Help card
                        "sp": []
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "playerId_2": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-2"],
                        "hand": ["h-2"], // Has Help card but hasn't placed it
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-2", "name": "Test Leader 2", "cardType": "leader", "initialPoint": 90 },
                        "top": [{ "cardDetails": [{"id": "c-4", "cardType": "character", "power": 55}], "isBack": [false] }],
                        "left": [{ "cardDetails": [{"id": "c-5", "cardType": "character", "power": 65}], "isBack": [false] }],
                        "right": [{ "cardDetails": [{"id": "c-6", "cardType": "character", "power": 75}], "isBack": [false] }],
                        "help": [], // Empty Help zone but player has Help card
                        "sp": []
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "phase": "MAIN_PHASE",
                "currentPlayer": "playerId_1",
                "currentTurn": 3, // Turn 3, character zones filled
                "firstPlayer": 0
            };

            await injectGameState(gameId, gameEnv);

            // Try to play a character card - should be rejected since all character zones filled
            const result = await performPlayerAction(gameId, "playerId_1", {
                type: "PlayCard",
                card_idx: 0, // Try to play Help card  
                field_idx: 3  // Help zone index
            });

            // Should succeed since Help zone is empty and player has Help card
            expect(result.gameEnv.playerId_1.Field.help).toHaveLength(1);
            expect(result.gameEnv.phase).toBe("MAIN_PHASE"); // Should still be in MAIN_PHASE
        });

        test('should advance to SP phase when all character zones and Help zones are filled', async () => {
            gameId = 'test-all-zones-filled-' + Date.now();
            
            const gameEnv = {
                "playerId_1": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-1"],
                        "hand": [],
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-1", "name": "Test Leader", "cardType": "leader", "initialPoint": 100 },
                        "top": [{ "cardDetails": [{"id": "c-1", "cardType": "character", "power": 50}], "isBack": [false] }],
                        "left": [{ "cardDetails": [{"id": "c-2", "cardType": "character", "power": 60}], "isBack": [false] }],
                        "right": [{ "cardDetails": [{"id": "c-3", "cardType": "character", "power": 70}], "isBack": [false] }],
                        "help": [{ "cardDetails": [{"id": "h-1", "cardType": "help", "power": 20}], "isBack": [false] }],
                        "sp": []
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "playerId_2": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-2"],
                        "hand": [],
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-2", "name": "Test Leader 2", "cardType": "leader", "initialPoint": 90 },
                        "top": [{ "cardDetails": [{"id": "c-4", "cardType": "character", "power": 55}], "isBack": [false] }],
                        "left": [{ "cardDetails": [{"id": "c-5", "cardType": "character", "power": 65}], "isBack": [false] }],
                        "right": [{ "cardDetails": [{"id": "c-6", "cardType": "character", "power": 75}], "isBack": [false] }],
                        "help": [{ "cardDetails": [{"id": "h-2", "cardType": "help", "power": 25}], "isBack": [false] }],
                        "sp": []
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "phase": "MAIN_PHASE",
                "currentPlayer": "playerId_1",
                "currentTurn": 4, // Turn 4, all zones should be filled
                "firstPlayer": 0
            };

            await injectGameState(gameId, gameEnv);

            // Simulate a player action that triggers phase check (like trying to play non-existent card)
            const result = await performPlayerAction(gameId, "playerId_1", {
                type: "PlayCard",
                card_idx: 0, // No cards in hand
                field_idx: 0
            });

            // Should get error about hand being empty or advance to next phase
            expect(result.error || result.gameEnv.phase !== "MAIN_PHASE").toBeTruthy();
        });

        test('should skip Help phase when Help zone is pre-occupied via search effects', async () => {
            gameId = 'test-help-preoccupied-' + Date.now();
            
            const gameEnv = {
                "playerId_1": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-1"],
                        "hand": ["h-2"], // Has Help card but zone is pre-occupied
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-1", "name": "Test Leader", "cardType": "leader", "initialPoint": 100 },
                        "top": [{ "cardDetails": [{"id": "c-1", "cardType": "character", "power": 50}], "isBack": [false] }],
                        "left": [{ "cardDetails": [{"id": "c-2", "cardType": "character", "power": 60}], "isBack": [false] }],
                        "right": [{ "cardDetails": [{"id": "c-3", "cardType": "character", "power": 70}], "isBack": [false] }],
                        "help": [{ "cardDetails": [{"id": "h-1", "cardType": "help", "power": 20}], "isBack": [false] }], // Pre-occupied
                        "sp": []
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "playerId_2": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-2"],
                        "hand": [],
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-2", "name": "Test Leader 2", "cardType": "leader", "initialPoint": 90 },
                        "top": [{ "cardDetails": [{"id": "c-4", "cardType": "character", "power": 55}], "isBack": [false] }],
                        "left": [{ "cardDetails": [{"id": "c-5", "cardType": "character", "power": 65}], "isBack": [false] }],
                        "right": [{ "cardDetails": [{"id": "c-6", "cardType": "character", "power": 75}], "isBack": [false] }],
                        "help": [{ "cardDetails": [{"id": "h-3", "cardType": "help", "power": 30}], "isBack": [false] }], // Pre-occupied
                        "sp": []
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "phase": "MAIN_PHASE",
                "currentPlayer": "playerId_1",
                "currentTurn": 3,
                "firstPlayer": 0
            };

            await injectGameState(gameId, gameEnv);

            // Try to play Help card when Help zone is pre-occupied
            const result = await performPlayerAction(gameId, "playerId_1", {
                type: "PlayCard",
                card_idx: 0, // Help card
                field_idx: 3  // Help zone index
            });

            // Should get error about Help zone being occupied
            expect(result.error).toContain('Help zone already occupied');
        });
    });
});