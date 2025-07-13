// Test cases for phase skipping logic when Help/SP zones are pre-occupied
const { loadTestScenario, injectGameState, performPlayerAction } = require('./testHelpers');
const gameLogic = require('../services/GameLogic');

describe('Phase Skipping Tests', () => {
    let gameId;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
    });

    describe('SP Phase Skipping', () => {
        test('should prevent SP card placement when SP zone is pre-occupied', async () => {
            gameId = 'test-sp-skip-' + Date.now();
            
            // Create game state where SP zone is pre-occupied by search effects
            const gameEnv = {
                "playerId_1": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-1"],
                        "hand": ["sp-2"],
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-1", "name": "Test Leader", "cardType": "leader", "initialPoint": 100 },
                        "top": [],
                        "left": [],
                        "right": [],
                        "help": [],
                        "sp": [{ "cardDetails": [{"id": "sp-1", "cardType": "sp", "power": 100}], "isBack": [false] }] // Pre-occupied via search effect
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
                        "top": [],
                        "left": [],
                        "right": [],
                        "help": [],
                        "sp": []
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "phase": "SP_PHASE", // In SP phase
                "currentPlayer": "playerId_1",
                "currentTurn": 1,
                "firstPlayer": 0
            };

            // Inject the game state
            await injectGameState(gameId, gameEnv);

            // Try to play SP card when SP zone is already occupied
            const result = await performPlayerAction(gameId, "playerId_1", {
                type: "PlayCard",
                card_idx: 0, // Play SP card from hand
                field_idx: 4  // SP zone index
            });

            // Should get error because SP zone is already occupied
            expect(result.error).toContain('SP zone already occupied');
        });

        test('should allow SP card placement when SP zone is empty', async () => {
            gameId = 'test-sp-allow-' + Date.now();
            
            const gameEnv = {
                "playerId_1": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-1"],
                        "hand": ["sp-1"],
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-1", "name": "Test Leader", "cardType": "leader", "initialPoint": 100 },
                        "top": [],
                        "left": [],
                        "right": [],
                        "help": [],
                        "sp": [] // Empty SP zone
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
                        "top": [],
                        "left": [],
                        "right": [],
                        "help": [],
                        "sp": [] // Empty SP zone
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "phase": "SP_PHASE", // Already in SP phase
                "currentPlayer": "playerId_1",
                "currentTurn": 1,
                "firstPlayer": 0
            };

            // Inject the game state
            await injectGameState(gameId, gameEnv);

            // Try to play SP card during SP phase with empty zone
            const result = await performPlayerAction(gameId, "playerId_1", {
                type: "PlayCard",
                card_idx: 0, // Play SP card from hand
                field_idx: 4  // SP zone index
            });

            // Should succeed since SP zone is empty and we're in SP phase
            expect(result.gameEnv.playerId_1.Field.sp).toHaveLength(1);
        });
    });

    describe('Help Phase Skipping', () => {
        test('should prevent help card placement when help zone is pre-occupied', async () => {
            gameId = 'test-help-skip-' + Date.now();
            
            const gameEnv = {
                "playerId_1": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["l-1"],
                        "hand": ["h-2"],
                        "mainDeck": []
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": { "id": "l-1", "name": "Test Leader", "cardType": "leader", "initialPoint": 100 },
                        "top": [],
                        "left": [],
                        "right": [],
                        "help": [{ "cardDetails": [{"id": "h-1", "cardType": "help", "power": 20}], "isBack": [false] }], // Pre-occupied via search effect
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
                        "top": [],
                        "left": [],
                        "right": [],
                        "help": [],
                        "sp": []
                    },
                    "playerPoint": 0,
                    "victoryPoints": 0
                },
                "phase": "MAIN_PHASE",
                "currentPlayer": "playerId_1",
                "currentTurn": 1,
                "firstPlayer": 0
            };

            // Inject the game state
            await injectGameState(gameId, gameEnv);

            // Try to play help card when help zone is already occupied
            const result = await performPlayerAction(gameId, "playerId_1", {
                type: "PlayCard",
                card_idx: 0, // Play help card from hand
                field_idx: 3  // Help zone index
            });

            // Should get error because help zone is already occupied
            expect(result.error).toContain('Help zone already occupied');
        });
    });
});