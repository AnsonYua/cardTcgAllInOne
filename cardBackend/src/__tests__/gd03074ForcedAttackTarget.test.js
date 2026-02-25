const { GameEnvironment } = require('../models/GameEnvironment');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { ForcedAttackTargetManager } = require('../services/battle/ForcedAttackTargetManager');

function createUnit(carduid, traits, overrides = {}) {
    return {
        carduid,
        cardData: {
            id: carduid.split('_')[0],
            name: carduid,
            cardType: 'unit',
            color: 'White',
            level: 3,
            cost: 2,
            traits,
            link: [],
            ap: 3,
            hp: 2,
            effects: { description: [], rules: [] }
        },
        isRested: false,
        damageReceived: 0,
        ...overrides
    };
}

function createPilot(carduid) {
    return {
        carduid,
        cardData: {
            id: carduid.split('_')[0],
            name: carduid,
            cardType: 'pilot',
            color: 'Blue',
            level: 3,
            cost: 1,
            traits: ['Test'],
            link: [],
            ap: 1,
            hp: 1,
            effects: { description: [], rules: [] }
        },
        isRested: false
    };
}

function gd03074Rule() {
    return {
        effectId: 'during_pair_effect',
        type: 'continuous',
        trigger: 'continuous',
        action: 'sequence',
        parameters: {
            text: 'While you have another (Superpower Bloc) Unit in play, enemy Units choose this rested Unit as their attack target if possible when attacking.',
            version: 1,
            steps: [
                {
                    action: 'conditional',
                    parameters: {
                        if: [
                            {
                                type: 'hasAnotherUnitWithTrait',
                                scope: 'self',
                                traits: ['Superpower Bloc']
                            }
                        ],
                        then: [
                            {
                                action: 'require_attack_target_if_available',
                                timing: { duration: 'continuous' },
                                parameters: {
                                    candidateTarget: {
                                        type: 'unit',
                                        scope: 'self',
                                        filters: { status: 'rested' }
                                    },
                                    chooser: 'DEFENDER'
                                }
                            }
                        ]
                    }
                }
            ]
        },
        sourceConditions: [{ type: 'paired' }]
    };
}

describe('GD03-074 forced attack target conditional sequence', () => {
    test('forces enemy attack to GD03-074 when another Superpower Bloc unit is in play', () => {
        const gameEnv = new GameEnvironment();
        const defender = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        defender.zones.slot1 = {
            unit: createUnit('GD03-074_unit_0001', ['Superpower Bloc'], {
                isRested: true,
                cardData: {
                    ...createUnit('GD03-074_unit_0001', ['Superpower Bloc']).cardData,
                    effects: {
                        description: ['GD03-074'],
                        rules: [gd03074Rule()]
                    }
                }
            }),
            pilot: createPilot('GD03-084_pilot_0001')
        };
        defender.zones.slot2 = {
            unit: createUnit('GD03-082_unit_0001', ['Superpower Bloc'], { isRested: true })
        };

        const attacker = gameEnv.getPlayer('playerId_2');
        attacker.zones.slot1 = { unit: createUnit('GD03-001_unit_0001', ['Earth Federation']) };

        const attackEvent = EventFactory.createPlayerActionEvent('playerId_2', 'attackUnit', {
            attackerCarduid: 'GD03-001_unit_0001',
            targetUnitUid: 'GD03-082_unit_0001',
            targetCarduid: 'GD03-082_unit_0001',
            targetPlayerId: 'playerId_1'
        });

        const result = ForcedAttackTargetManager.enforceIfNeeded(gameEnv, attackEvent, 'playerId_1');
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('FORCED_ATTACK_TARGET_REQUIRED');
        expect(result.error).toContain('GD03-074_unit_0001');
    });

    test('does not force target when no other Superpower Bloc unit is in play', () => {
        const gameEnv = new GameEnvironment();
        const defender = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        defender.zones.slot1 = {
            unit: createUnit('GD03-074_unit_0001', ['Superpower Bloc'], {
                isRested: true,
                cardData: {
                    ...createUnit('GD03-074_unit_0001', ['Superpower Bloc']).cardData,
                    effects: {
                        description: ['GD03-074'],
                        rules: [gd03074Rule()]
                    }
                }
            }),
            pilot: createPilot('GD03-084_pilot_0001')
        };
        defender.zones.slot2 = {
            unit: createUnit('OTHER_unit_0001', ['AEUG'], { isRested: true })
        };

        const attacker = gameEnv.getPlayer('playerId_2');
        attacker.zones.slot1 = { unit: createUnit('GD03-001_unit_0001', ['Earth Federation']) };

        const attackEvent = EventFactory.createPlayerActionEvent('playerId_2', 'attackUnit', {
            attackerCarduid: 'GD03-001_unit_0001',
            targetUnitUid: 'OTHER_unit_0001',
            targetCarduid: 'OTHER_unit_0001',
            targetPlayerId: 'playerId_1'
        });

        const result = ForcedAttackTargetManager.enforceIfNeeded(gameEnv, attackEvent, 'playerId_1');
        expect(result.success).toBe(true);
        expect(result.errorCode).toBeUndefined();
    });
});
