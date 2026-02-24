const { GameEnvironment } = require('../models/GameEnvironment');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { BlockerEffectManager } = require('../services/effects/BlockerEffectManager');
const gd03 = require('../data/gd03Card.json');

describe('GD03-118 temporary Blocker grant on GD03-068', () => {
    test('temporary Blocker grant enables blocker even when native base condition is not met', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const target = createUnitZoneCard({
            carduid: 'GD03-068_friendly_0002',
            cardId: 'GD03-068',
            cardDataExtras: gd03.cards['GD03-068']
        });
        target.isRested = false;
        gameEnv.getPlayer('playerId_1').zones.slot2.unit = target;

        // No friendly base in play => native GD03-068 blocker rule should not be active.
        const before = BlockerEffectManager.getAvailableBlockerTargets(gameEnv, 'playerId_1');
        expect(before.some((entry) => entry.carduid === 'GD03-068_friendly_0002')).toBe(false);

        const grantResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'grant_keyword',
                type: 'internal',
                trigger: 'SEQUENCE_STEP',
                optional: true,
                action: 'grant_keyword',
                target: {
                    type: 'unit',
                    scope: 'self_all_unit',
                    count: 1
                },
                timing: {
                    duration: 'UNTIL_END_OF_TURN'
                },
                parameters: {
                    keyword: 'Blocker'
                }
            },
            [{ carduid: 'GD03-068_friendly_0002', zone: 'slot2', playerId: 'playerId_1' }],
            'playerId_1',
            'GD03-118_hand_0001'
        );
        expect(grantResult.success).toBe(true);

        const after = BlockerEffectManager.getAvailableBlockerTargets(gameEnv, 'playerId_1');
        expect(after.some((entry) => entry.carduid === 'GD03-068_friendly_0002')).toBe(true);
    });
});
