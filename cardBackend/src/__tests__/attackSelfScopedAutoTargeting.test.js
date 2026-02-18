const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    const zones = player.zones || {};
    for (let i = 1; i <= 6; i++) {
        const slot = zones[`slot${i}`];
        if (slot && slot.unit && slot.unit.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

describe('ATTACK_PHASE self-scoped effects auto-target source', () => {
    test('unit attack self-buff applies to attacker without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'ST03-008_unit_test_0001';
        const allyUid = 'GD02-013_unit_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: allyUid,
            playAs: 'unit'
        }).success).toBe(true);

        const attackEvent = {
            playerId: 'playerId_1',
            data: {
                playerId: 'playerId_1',
                actionType: 'attackShieldArea',
                attackerCarduid: attackerUid,
                fromBurst: false
            }
        };

        const result = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, attackEvent);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        const attacker = findUnit(gameEnv, 'playerId_1', attackerUid);
        const ally = findUnit(gameEnv, 'playerId_1', allyUid);
        expect(attacker).toBeTruthy();
        expect(ally).toBeTruthy();

        expect(attacker.modifyAP || 0).toBe(2);
        expect(ally.modifyAP || 0).toBe(0);
    });

    test('pilot attack self-buff applies to paired unit without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const pairedUnitUid = 'GD02-013_unit_test_0002';
        const pilotUid = 'ST03-011_pilot_test_0001';
        const allyUid = 'ST03-008_unit_test_0002';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pairedUnitUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: pairedUnitUid
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: allyUid,
            playAs: 'unit'
        }).success).toBe(true);

        const attackEvent = {
            playerId: 'playerId_1',
            data: {
                playerId: 'playerId_1',
                actionType: 'attackShieldArea',
                attackerCarduid: pairedUnitUid,
                fromBurst: false
            }
        };

        const result = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, attackEvent);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        const pairedUnit = findUnit(gameEnv, 'playerId_1', pairedUnitUid);
        const ally = findUnit(gameEnv, 'playerId_1', allyUid);
        expect(pairedUnit).toBeTruthy();
        expect(ally).toBeTruthy();

        expect(pairedUnit.modifyAP || 0).toBe(1);
        expect(ally.modifyAP || 0).toBe(0);
    });
});
