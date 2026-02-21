const { GameEnvironment } = require('../models/GameEnvironment');
const { applySetActiveEffect } = require('../services/effects/actions/EffectSetActiveActions');
const {
    StateChangedByEffectEventConditionEvaluator
} = require('../services/effects/StateChangedByEffectEventConditionEvaluator');
const {
    __testUtils
} = require('../tests/validators/effectSchemaCanonicalValidation');

function createTriggeredUnit(carduid) {
    return {
        carduid,
        cardId: 'UNIT-SET-ACTIVE-TRIGGER',
        placedAt: 0,
        placedBy: 'playerId_1',
        isRested: true,
        damageReceived: 0,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: 3,
        originalHP: 3,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true,
        isFirstPlay: false,
        temporaryEffects: [],
        effectUsage: {},
        cardData: {
            id: 'UNIT-SET-ACTIVE-TRIGGER',
            name: 'Unit Set Active Trigger',
            cardType: 'unit',
            level: 4,
            ap: 3,
            hp: 3,
            effects: {
                description: [],
                rules: [
                    {
                        effectId: 'unit_set_active_by_effect_trigger',
                        type: 'triggered',
                        trigger: 'UNIT_SET_ACTIVE_BY_EFFECT',
                        action: 'modifyAP',
                        conditions: [
                            {
                                type: 'unitStateChangedByEffectEvent',
                                targetCarduid: 'self',
                                sourceController: 'self',
                                targetController: 'self',
                                fromState: 'rested',
                                toState: 'active'
                            }
                        ],
                        target: {
                            type: 'unit',
                            scope: 'self',
                            count: 1
                        },
                        parameters: {
                            value: 1
                        }
                    }
                ]
            }
        }
    };
}

describe('StateChangedByEffectEventConditionEvaluator', () => {
    test('supports self/source/literal targetCarduid semantics', () => {
        const context = {
            sourcePlayerId: 'playerId_1',
            targetPlayerId: 'playerId_1',
            targetCarduid: 'unit_1',
            targetCardType: 'unit',
            fromState: 'rested',
            toState: 'active'
        };

        expect(
            StateChangedByEffectEventConditionEvaluator.eventConditionsSatisfied(
                [{ type: 'unitStateChangedByEffectEvent', targetCarduid: 'self', toState: 'active' }],
                context,
                'playerId_1',
                'unit_1'
            )
        ).toBe(true);

        expect(
            StateChangedByEffectEventConditionEvaluator.eventConditionsSatisfied(
                [{ type: 'unitStateChangedByEffectEvent', targetCarduid: 'source', toState: 'active' }],
                context,
                'playerId_1',
                'unit_1'
            )
        ).toBe(true);

        expect(
            StateChangedByEffectEventConditionEvaluator.eventConditionsSatisfied(
                [{ type: 'unitStateChangedByEffectEvent', targetCarduid: 'other_unit', toState: 'active' }],
                context,
                'playerId_1',
                'unit_1'
            )
        ).toBe(false);
    });
});

describe('UNIT_SET_ACTIVE_BY_EFFECT dispatch', () => {
    test('setActive action dispatches UNIT_SET_ACTIVE_BY_EFFECT and applies triggered effect', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        p1.zones.slot1.unit = createTriggeredUnit('unit_1');

        const result = applySetActiveEffect(
            gameEnv,
            'playerId_1',
            { effectId: 'set_active_test' },
            [{ carduid: 'unit_1', zone: 'slot1', playerId: 'playerId_1' }]
        );

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(false);
        expect(p1.zones.slot1.unit.modifyAP || 0).toBe(1);
    });

    test('feature flag can disable UNIT_SET_ACTIVE_BY_EFFECT dispatch', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';
        gameEnv.runtimeFeatureFlags = {
            enableUnifiedStateChangedTriggers: true,
            enableUnitSetActiveByEffectTrigger: false
        };

        p1.zones.slot1.unit = createTriggeredUnit('unit_2');

        const result = applySetActiveEffect(
            gameEnv,
            'playerId_1',
            { effectId: 'set_active_test' },
            [{ carduid: 'unit_2', zone: 'slot1', playerId: 'playerId_1' }]
        );

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(false);
        expect(p1.zones.slot1.unit.modifyAP || 0).toBe(0);
    });
});

describe('Schema semantic hardening', () => {
    test('flags unknown dynamic level placeholders', () => {
        const diagnostics = [];
        __testUtils.walkEffects(
            [
                {
                    effectId: 'test',
                    trigger: 'MAIN_PHASE',
                    conditions: [],
                    target: {
                        type: 'unit',
                        scope: 'opponent',
                        filters: {
                            level: '<=unknownLevelToken'
                        }
                    }
                }
            ],
            { cardId: 'TEST-CARD', effectId: 'test', jsonPath: 'cards.TEST.effects.rules' },
            diagnostics
        );

        expect(
            diagnostics.some((diag) => String(diag.message).includes('unknown dynamic level placeholder'))
        ).toBe(true);
    });

    test('flags invalid unitStateChangedByEffectEvent state values', () => {
        const diagnostics = [];
        __testUtils.validateConditionEntry(
            {
                type: 'unitStateChangedByEffectEvent',
                toState: 'invalid_state'
            },
            'cards.TEST.effects.rules[0].conditions[0]',
            { cardId: 'TEST-CARD', effectId: 'test' },
            diagnostics
        );

        expect(
            diagnostics.some((diag) => String(diag.message).includes('toState must be one of rested|active'))
        ).toBe(true);
    });
});
