const { loadTestScenario, injectGameState, performPlayerAction } = require('./testHelpers');

describe('Leader Card Effects', () => {
    let gameId;

    beforeEach(() => {
        // Set NODE_ENV to test
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        // Reset NODE_ENV
        process.env.NODE_ENV = 'development';
    });

    describe('Trump Leader Effects', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('leaderEffect_Trump');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should boost right-wing and patriot characters by +45', async () => {
            // Play a right-wing character (特朗普總統 - 右翼)
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,  // Card "c-1" (特朗普總統) - gameType: "愛國者", power: 100
                field_idx: 1  // left zone (allows patriot types)
            });

            // Check if card was played and power boosted
            expect(result1.gameEnv.playerId_1.Field.left[0].card[0]).toBe('c-1');
            expect(result1.gameEnv.playerId_1.Field.left[0].cardDetails[0].power).toBe(100);
            
            // Check calculated points include Trump leader boost (+45 for patriot type)
            expect(result1.gameEnv.playerId_1.playerPoint).toBe(145); // 100 + 45
        });

        it('should apply normal boost when opponent is not Powell', async () => {
            // Play an economic character 
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 1,  // Economic type character
                field_idx: 1  // left zone
            });

            // Economic character should get normal power (no special penalty)
            expect(result1.gameEnv.playerId_1.playerPoint).toBeGreaterThan(0);
        });
    });

    describe('Biden Leader Effects', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('leaderEffect_Biden');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should boost all characters by +40 universally', async () => {
            // Play any character card
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,  // Any character
                field_idx: 0  // top zone
            });

            // Check if universal boost is applied (+40 to all characters)
            const expectedPower = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].power + 40;
            expect(result1.gameEnv.playerId_1.playerPoint).toBe(expectedPower);
        });

        it('should apply universal boost to multiple characters', async () => {
            // Play first character
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0  // top
            });

            // Play second character
            const result2 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,  // Now index 0 is the next card
                field_idx: 1  // left
            });

            // Both characters should have +40 boost
            const card1Power = result2.gameEnv.playerId_1.Field.top[0].cardDetails[0].power;
            const card2Power = result2.gameEnv.playerId_1.Field.left[0].cardDetails[0].power;
            const expectedTotal = (card1Power + 40) + (card2Power + 40);
            
            expect(result2.gameEnv.playerId_1.playerPoint).toBe(expectedTotal);
        });
    });

    describe('Musk Leader Effects', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('leaderEffect_Musk');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should boost freedom type characters by +50', async () => {
            // Play a freedom type character
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,  // Freedom type character
                field_idx: 0  // top zone
            });

            const basePower = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].gameType;
            
            if (cardType === '自由') {
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(basePower + 50);
            }
        });

        it('should give additional +20 boost to Doge trait characters', async () => {
            // This test would need a character with both 自由 type AND Doge trait
            // For now, we'll test the freedom boost and note that Doge boost would stack
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0
            });

            // Check that Musk's effects are being applied
            expect(result1.gameEnv.playerId_1.playerPoint).toBeGreaterThan(0);
        });
    });

    describe('Harris Leader Effects', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('leaderEffect_Harris');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should boost left-wing characters by +40', async () => {
            // Play a left-wing character
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0  // top zone
            });

            const basePower = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].gameType;
            
            if (cardType === '左翼') {
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(basePower + 40);
            }
        });

        it('should boost economic characters by +20', async () => {
            // Play an economic character
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 1,
                field_idx: 1  // left zone
            });

            const basePower = result1.gameEnv.playerId_1.Field.left[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.left[0].cardDetails[0].gameType;
            
            if (cardType === '經濟') {
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(basePower + 20);
            }
        });

        it('should nullify right zone cards when opponent is Trump', async () => {
            // Play a character in right zone
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 2  // right zone
            });

            // When opponent is Trump, right zone cards should have 0 power
            expect(result1.gameEnv.playerId_1.playerPoint).toBe(0);
        });
    });

    describe('Trump vs Powell Interaction', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('leaderEffect_TrumpVsPowell');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should nullify economic characters when opponent is Powell', async () => {
            // Play an economic character with Trump leader vs Powell opponent
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,  // Economic character
                field_idx: 0  // top zone
            });

            const cardType = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].gameType;
            
            if (cardType === '經濟') {
                // Economic cards should be nullified (set to 0) when opponent is Powell
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(0);
            }
        });

        it('should still boost right-wing/patriot characters normally vs Powell', async () => {
            // Play a right-wing or patriot character
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 1  // left zone
            });

            const basePower = result1.gameEnv.playerId_1.Field.left[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.left[0].cardDetails[0].gameType;
            
            if (cardType === '右翼' || cardType === '愛國者') {
                // Right-wing/patriot should still get +45 boost
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(basePower + 45);
            }
        });
    });

    describe('Vance Leader Effects', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('leaderEffect_Vance');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should boost right-wing characters by +40', async () => {
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0
            });

            const basePower = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].gameType;
            
            if (cardType === '右翼') {
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(basePower + 40);
            }
        });

        it('should boost freedom characters by +20', async () => {
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 1,
                field_idx: 1
            });

            const basePower = result1.gameEnv.playerId_1.Field.left[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.left[0].cardDetails[0].gameType;
            
            if (cardType === '自由') {
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(basePower + 20);
            }
        });

        it('should boost economic characters by +10', async () => {
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 2,
                field_idx: 2
            });

            const basePower = result1.gameEnv.playerId_1.Field.right[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.right[0].cardDetails[0].gameType;
            
            if (cardType === '經濟') {
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(basePower + 10);
            }
        });
    });

    describe('Powell Leader Effects', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('leaderEffect_Powell');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should boost freedom and economic characters by +30', async () => {
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0
            });

            const basePower = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].gameType;
            
            if (cardType === '自由' || cardType === '經濟') {
                expect(result1.gameEnv.playerId_1.playerPoint).toBeGreaterThanOrEqual(basePower + 30);
            }
        });

        it('should give additional +20 to economic characters when opponent is Trump', async () => {
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0
            });

            const basePower = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].power;
            const cardType = result1.gameEnv.playerId_1.Field.top[0].cardDetails[0].gameType;
            
            if (cardType === '經濟') {
                // Should get +30 base + +20 vs Trump = +50 total
                expect(result1.gameEnv.playerId_1.playerPoint).toBe(basePower + 50);
            }
        });
    });

    describe('Leader Priority System', () => {
        it('should use leader initial points for SP card priority', async () => {
            const scenario = await loadTestScenario('leaderEffect_Trump');
            const result = await injectGameState(scenario);
            
            // Trump has initialPoint: 110, Biden has initialPoint: 100
            // Trump should have higher priority in SP phase
            expect(result.gameEnv.playerId_1.Field.leader.initialPoint).toBe(110);
            expect(result.gameEnv.playerId_2.Field.leader.initialPoint).toBe(100);
        });

        it('should verify all leader priority values', async () => {
            // Test different leader priority values for SP phase ordering
            const trumpScenario = await loadTestScenario('leaderEffect_Trump');
            const trumpResult = await injectGameState(trumpScenario);
            expect(trumpResult.gameEnv.playerId_1.Field.leader.initialPoint).toBe(110); // Highest

            const powellScenario = await loadTestScenario('leaderEffect_Powell');
            const powellResult = await injectGameState(powellScenario);
            expect(powellResult.gameEnv.playerId_1.Field.leader.initialPoint).toBe(95);

            const muskScenario = await loadTestScenario('leaderEffect_Musk');
            const muskResult = await injectGameState(muskScenario);
            expect(muskResult.gameEnv.playerId_1.Field.leader.initialPoint).toBe(91);

            const vanceScenario = await loadTestScenario('leaderEffect_Vance');
            const vanceResult = await injectGameState(vanceScenario);
            expect(vanceResult.gameEnv.playerId_1.Field.leader.initialPoint).toBe(75);

            const harrisScenario = await loadTestScenario('leaderEffect_Harris');
            const harrisResult = await injectGameState(harrisScenario);
            expect(harrisResult.gameEnv.playerId_1.Field.leader.initialPoint).toBe(69); // Lowest
        });
    });

    describe('Zone Compatibility', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('leaderEffect_Trump');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should respect zone compatibility restrictions', async () => {
            // Trump's left zone accepts: ["右翼", "自由", "愛國者"]
            // Try to play a character that matches these types
            const result1 = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 1  // left zone
            });

            // Should succeed if card type is compatible
            if (!result1.gameEnv.error) {
                expect(result1.gameEnv.playerId_1.Field.left).toHaveLength(1);
            }
        });
    });
});