const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

function setupSingleTarget() {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.currentTurn = 3;

    p1.zones.slot1.unit = createUnitZoneCard({
        carduid: 'TARGET_unit_0001',
        cardId: 'TEST-UNIT-001',
        name: 'Target Unit',
        ap: 3,
        hp: 4,
        cardDataExtras: { level: 2, cost: 1, color: 'Blue' }
    });

    return { gameEnv, target: p1.zones.slot1.unit };
}

function targetRef(carduid) {
    return { carduid, zone: 'slot1', playerId: 'playerId_1' };
}

describe('EffectExecutor temporary stat duration registration', () => {
    test('registers temporary effect for modifyAP until end of battle', () => {
        const { gameEnv, target } = setupSingleTarget();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'temp_ap_battle',
                action: 'modifyAP',
                timing: { duration: 'UNTIL_END_OF_BATTLE' },
                parameters: { value: 2 }
            },
            [targetRef(target.carduid)],
            'playerId_1',
            'SRC_CARD_0001'
        );

        expect(result.success).toBe(true);
        expect(target.modifyAP).toBe(2);
        expect(target.temporaryEffects).toHaveLength(1);
        expect(target.temporaryEffects[0]).toMatchObject({
            sourceCarduid: 'SRC_CARD_0001',
            duration: 'UNTIL_END_OF_BATTLE',
            modifyAP: 2
        });
    });

    test('keeps existing UNTIL_END_OF_TURN temporary stat registration behavior', () => {
        const { gameEnv, target } = setupSingleTarget();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'temp_ap_turn',
                action: 'modifyAP',
                timing: { duration: 'UNTIL_END_OF_TURN' },
                parameters: { value: 1 }
            },
            [targetRef(target.carduid)],
            'playerId_1',
            'SRC_CARD_0002'
        );

        expect(result.success).toBe(true);
        expect(target.modifyAP).toBe(1);
        expect(target.temporaryEffects).toHaveLength(1);
        expect(target.temporaryEffects[0].duration).toBe('UNTIL_END_OF_TURN');
        expect(target.temporaryEffects[0].modifyAP).toBe(1);
    });

    test('does not register stat temporary effect for non-stat fallback action', () => {
        const { gameEnv, target } = setupSingleTarget();
        target.damageReceived = 1;

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'heal_not_temp_stat',
                action: 'heal',
                timing: { duration: 'UNTIL_END_OF_BATTLE' },
                parameters: { value: 1 }
            },
            [targetRef(target.carduid)],
            'playerId_1',
            'SRC_CARD_0003'
        );

        expect(result.success).toBe(true);
        expect(target.damageReceived).toBe(0);
        expect(target.temporaryEffects).toHaveLength(0);
        expect(target.modifyAP).toBe(0);
    });
});
