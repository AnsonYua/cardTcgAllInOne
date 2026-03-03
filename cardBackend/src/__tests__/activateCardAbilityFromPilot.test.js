const { GameEnvironment } = require('../models/GameEnvironment');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');

describe('activateCardAbility (pilot source)', () => {
    test('pilot activated ability can resolve from slot pilot carduid', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        // Condition: opponent has 8+ cards in hand.
        p2.deck._handUids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];

        // Slot with a rested unit + a pilot that can activate to set its paired unit active.
        p1.zones.slot1.unit = {
            carduid: 'GD01-001_unit_0001',
            cardId: 'GD01-001',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: true,
            damageReceived: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            originalAP: 3,
            originalHP: 3,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: false,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-001',
                name: 'Gundam',
                cardType: 'unit',
                ap: 3,
                hp: 3,
                effects: { description: [], rules: [] }
            }
        };

        p1.zones.slot1.pilot = {
            carduid: 'GD01-097_pilot_0001',
            cardId: 'GD01-097',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            isFirstPlay: false,
            originalAP: 1,
            originalHP: 1,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-097',
                name: 'Guel Jeturk',
                cardType: 'pilot',
                effects: {
                    description: [],
                    rules: [
                        {
                            effectId: 'activate_effect',
                            type: 'activated',
                            timing: {
                                windows: ['MAIN_PHASE']
                            },
                            cost: {
                                oncePerTurn: true
                            },
                            conditions: [
                                {
                                    type: 'opponentHandSize',
                                    scope: 'opponent',
                                    value: '>=8'
                                }
                            ],
                            action: 'setActive',
                            target: {
                                type: 'unit',
                                scope: 'source_paired_unit',
                                count: 1
                            }
                        }
                    ]
                }
            }
        };

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD01-097_pilot_0001',
                effectId: 'activate_effect'
            }
        });

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(false);
    });

    test('scope=source with unit target resolves to paired unit when source is pilot', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        p1.zones.slot1.unit = {
            carduid: 'host_unit_0001',
            cardId: 'GD01-079',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            damageReceived: 1,
            continueModifyAP: 0,
            continueModifyHP: 0,
            originalAP: 2,
            originalHP: 2,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-079',
                name: 'Skygrasper',
                cardType: 'unit',
                ap: 2,
                hp: 2,
                effects: { description: [], rules: [] }
            }
        };

        p1.zones.slot1.pilot = {
            carduid: 'pilot_source_0001',
            cardId: 'GD01-098',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            isFirstPlay: false,
            originalAP: 2,
            originalHP: 1,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-098',
                name: 'Elan Ceres (Enhanced Person Number 4)',
                cardType: 'pilot',
                effects: {
                    description: [],
                    rules: [
                        {
                            effectId: 'activate_heal',
                            type: 'activated',
                            timing: {
                                windows: ['MAIN_PHASE']
                            },
                            cost: {
                                oncePerTurn: true
                            },
                            target: {
                                type: 'unit',
                                scope: 'source',
                                count: 1
                            },
                            action: 'heal',
                            parameters: {
                                value: 1
                            }
                        }
                    ]
                }
            }
        };

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_2',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'pilot_source_0001',
                effectId: 'activate_heal'
            }
        });

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.damageReceived).toBe(0);
    });

    test('unitsInPlayWithFilter ap condition blocks pilot heal when opponent has no AP<=1 unit', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'ACTION_STEP_PHASE';

        p1.zones.slot1.unit = {
            carduid: 'host_unit_0002',
            cardId: 'GD01-079',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            damageReceived: 1,
            continueModifyAP: 0,
            continueModifyHP: 0,
            originalAP: 2,
            originalHP: 2,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-079',
                name: 'Skygrasper',
                cardType: 'unit',
                ap: 2,
                hp: 2,
                effects: { description: [], rules: [] }
            }
        };

        p1.zones.slot1.pilot = {
            carduid: 'pilot_source_0002',
            cardId: 'GD01-098',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            isFirstPlay: false,
            originalAP: 2,
            originalHP: 1,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-098',
                name: 'Elan Ceres (Enhanced Person Number 4)',
                cardType: 'pilot',
                effects: {
                    description: [],
                    rules: [
                        {
                            effectId: 'activate_heal',
                            type: 'activated',
                            timing: {
                                windows: ['ACTION_STEP']
                            },
                            cost: {
                                oncePerTurn: true
                            },
                            conditions: [
                                {
                                    type: 'unitsInPlayWithFilter',
                                    scope: 'opponent',
                                    filters: {
                                        ap: '<=1'
                                    },
                                    value: '>=1'
                                }
                            ],
                            target: {
                                type: 'unit',
                                scope: 'source_paired_unit',
                                count: 1
                            },
                            action: 'heal',
                            parameters: {
                                value: 1
                            }
                        }
                    ]
                }
            }
        };

        p2.zones.slot2.unit = {
            carduid: 'enemy_unit_ap2_0001',
            cardId: 'GD01-020',
            placedAt: 0,
            placedBy: 'playerId_2',
            isRested: false,
            damageReceived: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            originalAP: 2,
            originalHP: 3,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-020',
                name: 'Anksha',
                cardType: 'unit',
                ap: 2,
                hp: 3,
                effects: { description: [], rules: [] }
            }
        };

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_3',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'pilot_source_0002',
                effectId: 'activate_heal'
            }
        });

        expect(result.success).toBe(false);
        expect(p1.zones.slot1.unit.damageReceived).toBe(1);
    });

    test('unitsInPlayWithFilter ap condition allows pilot heal when opponent has AP<=1 unit', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'ACTION_STEP_PHASE';

        p1.zones.slot1.unit = {
            carduid: 'host_unit_0003',
            cardId: 'GD01-079',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            damageReceived: 1,
            continueModifyAP: 0,
            continueModifyHP: 0,
            originalAP: 2,
            originalHP: 2,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-079',
                name: 'Skygrasper',
                cardType: 'unit',
                ap: 2,
                hp: 2,
                effects: { description: [], rules: [] }
            }
        };

        p1.zones.slot1.pilot = {
            carduid: 'pilot_source_0003',
            cardId: 'GD01-098',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            isFirstPlay: false,
            originalAP: 2,
            originalHP: 1,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-098',
                name: 'Elan Ceres (Enhanced Person Number 4)',
                cardType: 'pilot',
                effects: {
                    description: [],
                    rules: [
                        {
                            effectId: 'activate_heal',
                            type: 'activated',
                            timing: {
                                windows: ['ACTION_STEP']
                            },
                            cost: {
                                oncePerTurn: true
                            },
                            conditions: [
                                {
                                    type: 'unitsInPlayWithFilter',
                                    scope: 'opponent',
                                    filters: {
                                        ap: '<=1'
                                    },
                                    value: '>=1'
                                }
                            ],
                            target: {
                                type: 'unit',
                                scope: 'source_paired_unit',
                                count: 1
                            },
                            action: 'heal',
                            parameters: {
                                value: 1
                            }
                        }
                    ]
                }
            }
        };

        p2.zones.slot2.unit = {
            carduid: 'enemy_unit_ap1_0001',
            cardId: 'GD01-014',
            placedAt: 0,
            placedBy: 'playerId_2',
            isRested: false,
            damageReceived: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            originalAP: 1,
            originalHP: 3,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD01-014',
                name: 'G-Sky Easy',
                cardType: 'unit',
                ap: 1,
                hp: 3,
                effects: { description: [], rules: [] }
            }
        };

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_4',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'pilot_source_0003',
                effectId: 'activate_heal'
            }
        });

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.damageReceived).toBe(0);
    });
});
