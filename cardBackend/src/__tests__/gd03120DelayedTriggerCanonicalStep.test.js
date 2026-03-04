const { GameEnvironment } = require('../models/GameEnvironment');
const { DelayedTriggerManager } = require('../services/effects/DelayedTriggerManager');
const { AttackPreparationManager } = require('../services/AttackPreparationManager');

function createUnit(carduid, cardId, { traits = [], isRested = false } = {}) {
    return {
        carduid,
        cardId,
        placedAt: 0,
        placedBy: 'playerId_1',
        isRested,
        originalAP: 3,
        originalHP: 3,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        temporaryEffects: [],
        effectUsage: {},
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            traits,
            ap: 3,
            hp: 3,
            effects: { description: [], rules: [] }
        }
    };
}

function createTestEnv() {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.currentTurn = 7;
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.phase = 'MAIN_PHASE';

    const p1 = gameEnv.players.playerId_1;
    const p2 = gameEnv.players.playerId_2;

    p1.zones.slot1.unit = createUnit('gd03120_attacker_0001', 'GD03-081', {
        traits: ['Superpower Bloc'],
        isRested: false
    });
    p1.zones.slot2.unit = createUnit('gd03120_target_0001', 'GD03-069', {
        traits: ['UN'],
        isRested: true
    });

    p2.zones.slot1.unit = createUnit('gd03120_enemy_0001', 'GD03-050', {
        traits: ['Zeon'],
        isRested: true
    });

    return gameEnv;
}

function assertDelayedSetActiveThenCannotAttackApplied(gameEnv) {
    const targetUnit = gameEnv.players.playerId_1.zones.slot2.unit;
    expect(targetUnit).toBeTruthy();
    expect(targetUnit.isRested).toBe(false);

    const restrictions = Array.isArray(targetUnit.activeRestrictions)
        ? targetUnit.activeRestrictions
        : [];
    expect(restrictions.some((entry) => entry?.restriction === 'cannot_attack')).toBe(true);

    const attackValidation = AttackPreparationManager.validateShieldAttackAttacker(
        gameEnv,
        'playerId_1',
        targetUnit.carduid
    );
    expect(attackValidation.success).toBe(false);
    expect((attackValidation.error || '').toLowerCase()).toContain('cannot attack');
}

describe('GD03-120 delayed trigger canonical step', () => {
    test('supports canonical delayed then step action setActive_then_restrict_attack', () => {
        const gameEnv = createTestEnv();

        const register = DelayedTriggerManager.registerFromSequenceStep(
            gameEnv,
            'playerId_1',
            'GD03-120_command_0001',
            {
                duration: 'UNTIL_END_OF_TURN',
                trigger: {
                    type: 'BATTLE_DESTROY',
                    attackerController: 'self',
                    attackerTraitsAny: ['Superpower Bloc', 'UN']
                },
                then: [
                    {
                        action: 'setActive_then_restrict_attack',
                        timing: { duration: 'UNTIL_END_OF_TURN' },
                        target: {
                            type: 'unit',
                            scope: 'self_all_unit',
                            count: 1,
                            filters: {
                                traitsAny: ['Superpower Bloc', 'UN'],
                                status: 'rested'
                            }
                        },
                        parameters: {
                            restriction: 'cannot_attack'
                        }
                    }
                ]
            }
        );
        expect(register.success).toBe(true);

        const result = DelayedTriggerManager.handleBattleDestroy(gameEnv, {
            sourcePlayerId: 'playerId_1',
            sourceUnit: gameEnv.players.playerId_1.zones.slot1.unit,
            sourceSlot: 'slot1',
            destroyedPlayerId: 'playerId_2',
            destroyedSlot: 'slot1',
            destroyedUnit: gameEnv.players.playerId_2.zones.slot1.unit
        });
        expect(result.success).toBe(true);

        assertDelayedSetActiveThenCannotAttackApplied(gameEnv);
    });

    test('keeps legacy delayed then step format (setActive + applyStatusEffect) working', () => {
        const gameEnv = createTestEnv();

        const register = DelayedTriggerManager.registerFromSequenceStep(
            gameEnv,
            'playerId_1',
            'GD03-120_command_0001',
            {
                duration: 'UNTIL_END_OF_TURN',
                trigger: {
                    type: 'BATTLE_DESTROY',
                    attackerController: 'self',
                    attackerTraitsAny: ['Superpower Bloc', 'UN']
                },
                then: [
                    {
                        action: 'setActive',
                        target: {
                            type: 'unit',
                            scope: 'self_all_unit',
                            count: 1,
                            filters: {
                                traitsAny: ['Superpower Bloc', 'UN'],
                                status: 'rested'
                            }
                        }
                    },
                    {
                        action: 'applyStatusEffect',
                        timing: { duration: 'UNTIL_END_OF_TURN' },
                        parameters: { restriction: 'cannot_attack' }
                    }
                ]
            }
        );
        expect(register.success).toBe(true);

        const result = DelayedTriggerManager.handleBattleDestroy(gameEnv, {
            sourcePlayerId: 'playerId_1',
            sourceUnit: gameEnv.players.playerId_1.zones.slot1.unit,
            sourceSlot: 'slot1',
            destroyedPlayerId: 'playerId_2',
            destroyedSlot: 'slot1',
            destroyedUnit: gameEnv.players.playerId_2.zones.slot1.unit
        });
        expect(result.success).toBe(true);

        assertDelayedSetActiveThenCannotAttackApplied(gameEnv);
    });
});
