const gameLogic = require('../services/GameLogic');

describe('Search Card Debug', () => {
    it('should inject test scenario successfully', async () => {
        const testScenario = {
            "gameId": "test-debug",
            "gameEnv": {
                "playerId_1": {
                    "deck": {
                        "currentLeaderIdx": 0,
                        "leader": ["S002"],
                        "hand": ["53"],
                        "mainDeck": ["43", "44", "45"]
                    },
                    "redraw": 1,
                    "turnAction": [],
                    "Field": {
                        "leader": {
                            "id": "S002",
                            "name": "拜登",
                            "cardType": "leader",
                            "gameType": "左翼",
                            "initialPoint": 100,
                            "level": 7,
                            "zoneCompatibility": {
                                "top": ["all"],
                                "left": ["all"],
                                "right": ["all"]
                            }
                        },
                        "top": [],
                        "left": [],
                        "right": [],
                        "help": [],
                        "sp": []
                    },
                    "playerPoint": 0
                },
                "firstPlayer": 0,
                "phase": "MAIN_PHASE",
                "currentPlayer": "playerId_1",
                "currentTurn": 0
            }
        };

        const result = await gameLogic.injectGameState(testScenario.gameId, testScenario.gameEnv);
        expect(result).toBeDefined();
        expect(result.gameId).toBe("test-debug");
        
        // Try a simple action
        const actionRequest = {
            body: {
                playerId: 'playerId_1',
                gameId: 'test-debug',
                action: {
                    type: "PlayCard",
                    card_idx: 0,
                    field_idx: 0
                }
            }
        };

        console.log('About to call processPlayerAction...');
        const actionResult = await gameLogic.processPlayerAction(actionRequest);
        console.log('Action result:', JSON.stringify(actionResult, null, 2));
        
        expect(actionResult).toBeDefined();
    });
});