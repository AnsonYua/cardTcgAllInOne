const CardEffectManager = require('../services/CardEffectManager');
const TestHelper = require('./helpers/testHelper');

describe('CardEffectManager Unit Tests', () => {
    let cardEffectManager;
    let testHelper;

    beforeEach(() => {
        cardEffectManager = new CardEffectManager();
        testHelper = new TestHelper();
    });

    describe('Zone Restriction Validation', () => {
        test('should validate character card placement in character zones', async () => {
            const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-2');
            
            // Set up Trump leader with zone restrictions
            gameEnv.gameEnv.zones.playerId_1.leader = {
                id: 's-1',
                name: '特朗普',
                zoneCompatibility: {
                    top: ['右翼', '自由', '經濟'],
                    left: ['右翼', '自由', '愛國者'],
                    right: ['右翼', '愛國者', '經濟']
                }
            };
            
            const characterCard = {
                id: 'c-1',
                cardType: 'character',
                gameType: '愛國者',
                power: 100
            };
            
            // Test valid placement
            const validResult = await cardEffectManager.checkSummonRestriction(
                gameEnv.gameEnv, 
                'playerId_1', 
                characterCard, 
                'left'
            );
            
            expect(validResult.canPlace).toBe(true);
            
            // Test invalid placement
            const invalidResult = await cardEffectManager.checkSummonRestriction(
                gameEnv.gameEnv, 
                'playerId_1', 
                characterCard, 
                'top'
            );
            
            expect(invalidResult.canPlace).toBe(false);
            expect(invalidResult.reason).toContain('Leader does not allow');
        });

        test('should prevent character cards from being placed in help or sp zones', async () => {
            const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-2');
            
            const characterCard = {
                id: 'c-1',
                cardType: 'character',
                gameType: '愛國者',
                power: 100
            };
            
            // Test help zone
            const helpResult = await cardEffectManager.checkSummonRestriction(
                gameEnv.gameEnv, 
                'playerId_1', 
                characterCard, 
                'help'
            );
            
            expect(helpResult.canPlace).toBe(false);
            expect(helpResult.reason).toContain('Character cards cannot be placed in help position');
            
            // Test sp zone
            const spResult = await cardEffectManager.checkSummonRestriction(
                gameEnv.gameEnv, 
                'playerId_1', 
                characterCard, 
                'sp'
            );
            
            expect(spResult.canPlace).toBe(false);
            expect(spResult.reason).toContain('Character cards cannot be placed in sp position');
        });
    });

    describe('Power Calculation Logic', () => {
        test('should calculate base power correctly', () => {
            const card = {
                id: 'c-1',
                name: '總統特朗普',
                cardType: 'character',
                gameType: '愛國者',
                power: 100
            };
            
            const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-2');
            const actualPower = testHelper.calculateActualPower(card, gameEnv.gameEnv, 'playerId_1');
            
            expect(actualPower).toBe(100); // Base power without leader effects
        });

        test('should apply Trump leader boost to patriot cards', () => {
            const card = {
                id: 'c-1',
                name: '總統特朗普',
                cardType: 'character',
                gameType: '愛國者',
                power: 100
            };
            
            const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-2');
            
            // Set up Trump leader
            gameEnv.gameEnv.zones.playerId_1.leader = {
                id: 's-1',
                name: '特朗普',
                effects: {
                    rules: [
                        {
                            id: 'trump_rightWing_patriot_boost',
                            type: 'continuous',
                            trigger: { event: 'always', conditions: [] },
                            target: {
                                owner: 'self',
                                zones: ['top', 'left', 'right'],
                                filters: [
                                    {
                                        type: 'gameTypeOr',
                                        values: ['右翼', '愛國者']
                                    }
                                ]
                            },
                            effect: {
                                type: 'powerBoost',
                                value: 45
                            }
                        }
                    ]
                }
            };
            
            const actualPower = testHelper.calculateActualPower(card, gameEnv.gameEnv, 'playerId_1');
            
            expect(actualPower).toBe(145); // 100 base + 45 Trump boost
        });

        test('should apply setPower effects correctly', () => {
            const card = {
                id: 'c-13',
                name: '經濟卡',
                cardType: 'character',
                gameType: '經濟',
                power: 40
            };
            
            const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-6');
            
            // Set up Trump leader with Powell opponent (triggers setPower to 0)
            gameEnv.gameEnv.zones.playerId_1.leader = {
                id: 's-1',
                name: '特朗普',
                effects: {
                    rules: [
                        {
                            id: 'trump_vs_powell_economy_nerf',
                            type: 'continuous',
                            trigger: {
                                event: 'always',
                                conditions: [
                                    {
                                        type: 'opponentLeader',
                                        value: '鮑威爾'
                                    }
                                ]
                            },
                            target: {
                                owner: 'self',
                                zones: ['top', 'left', 'right'],
                                filters: [
                                    {
                                        type: 'gameType',
                                        value: '經濟'
                                    }
                                ]
                            },
                            effect: {
                                type: 'setPower',
                                value: 0
                            }
                        }
                    ]
                }
            };
            
            // Set up Powell as opponent
            gameEnv.gameEnv.zones.playerId_2.leader = {
                id: 's-6',
                name: '鮑威爾'
            };
            
            const actualPower = testHelper.calculateActualPower(card, gameEnv.gameEnv, 'playerId_1');
            
            expect(actualPower).toBe(0); // Power set to 0 by Trump's effect
        });
    });

    describe('Filter Matching Logic', () => {
        test('should match gameType filter correctly', () => {
            const card = {
                id: 'c-1',
                gameType: '愛國者',
                power: 100
            };
            
            const filter = {
                type: 'gameType',
                value: '愛國者'
            };
            
            const result = testHelper.doesFilterMatch(filter, card, {});
            expect(result).toBe(true);
            
            // Test non-matching
            const nonMatchingFilter = {
                type: 'gameType',
                value: '右翼'
            };
            
            const nonMatchingResult = testHelper.doesFilterMatch(nonMatchingFilter, card, {});
            expect(nonMatchingResult).toBe(false);
        });

        test('should match gameTypeOr filter correctly', () => {
            const card = {
                id: 'c-1',
                gameType: '愛國者',
                power: 100
            };
            
            const filter = {
                type: 'gameTypeOr',
                values: ['右翼', '愛國者']
            };
            
            const result = testHelper.doesFilterMatch(filter, card, {});
            expect(result).toBe(true);
            
            // Test non-matching
            const nonMatchingFilter = {
                type: 'gameTypeOr',
                values: ['左翼', '自由']
            };
            
            const nonMatchingResult = testHelper.doesFilterMatch(nonMatchingFilter, card, {});
            expect(nonMatchingResult).toBe(false);
        });

        test('should match trait filter correctly', () => {
            const card = {
                id: 'c-1',
                traits: ['特朗普家族'],
                power: 100
            };
            
            const filter = {
                type: 'trait',
                value: '特朗普家族'
            };
            
            const result = testHelper.doesFilterMatch(filter, card, {});
            expect(result).toBe(true);
            
            // Test non-matching
            const nonMatchingFilter = {
                type: 'trait',
                value: '平民'
            };
            
            const nonMatchingResult = testHelper.doesFilterMatch(nonMatchingFilter, card, {});
            expect(nonMatchingResult).toBe(false);
        });

        test('should match nameContains filter correctly', () => {
            const card = {
                id: 'c-8',
                name: '狗狗幣Doge概念',
                power: 80
            };
            
            const filter = {
                type: 'nameContains',
                value: 'Doge'
            };
            
            const result = testHelper.doesFilterMatch(filter, card, {});
            expect(result).toBe(true);
            
            // Test non-matching
            const nonMatchingFilter = {
                type: 'nameContains',
                value: 'Bitcoin'
            };
            
            const nonMatchingResult = testHelper.doesFilterMatch(nonMatchingFilter, card, {});
            expect(nonMatchingResult).toBe(false);
        });
    });

    describe('Condition Matching Logic', () => {
        test('should match opponentLeader condition correctly', () => {
            const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-6');
            
            // Set up Powell as opponent
            gameEnv.gameEnv.zones.playerId_2.leader = {
                id: 's-6',
                name: '鮑威爾'
            };
            
            const condition = {
                type: 'opponentLeader',
                value: '鮑威爾'
            };
            
            const result = testHelper.doesConditionMatch(condition, gameEnv.gameEnv, 'playerId_1');
            expect(result).toBe(true);
            
            // Test non-matching
            const nonMatchingCondition = {
                type: 'opponentLeader',
                value: '拜登'
            };
            
            const nonMatchingResult = testHelper.doesConditionMatch(nonMatchingCondition, gameEnv.gameEnv, 'playerId_1');
            expect(nonMatchingResult).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing leader gracefully', async () => {
            const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-2');
            
            // Remove leader
            gameEnv.gameEnv.zones.playerId_1.leader = null;
            
            const characterCard = {
                id: 'c-1',
                cardType: 'character',
                gameType: '愛國者',
                power: 100
            };
            
            const result = await cardEffectManager.checkSummonRestriction(
                gameEnv.gameEnv, 
                'playerId_1', 
                characterCard, 
                'top'
            );
            
            // Should allow placement when no leader restrictions exist
            expect(result.canPlace).toBe(true);
        });

        test('should handle invalid filter types gracefully', () => {
            const card = {
                id: 'c-1',
                gameType: '愛國者',
                power: 100
            };
            
            const invalidFilter = {
                type: 'invalidFilterType',
                value: 'someValue'
            };
            
            const result = testHelper.doesFilterMatch(invalidFilter, card, {});
            expect(result).toBe(true); // Should default to true for unknown filter types
        });
    });
});