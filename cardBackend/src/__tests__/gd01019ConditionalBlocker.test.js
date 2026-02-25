const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { BlockerChoiceManager } = require('../services/BlockerChoiceManager');

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

describe('GD01-019 Byarlant Custom (conditional Blocker)', () => {
    test('gains Blocker when opponent has 4+ units (blocker choice created)', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const blockerUid = 'GD01-019_unit_blocker_test_0001';
        const targetUid = 'GD01-007_unit_target_test_0001';

        const attackerUid = 'GD01-012_unit_attacker_test_0001';
        const filler1 = 'GD01-001_unit_filler_test_0001';
        const filler2 = 'GD01-002_unit_filler_test_0002';
        const filler3 = 'GD01-003_unit_filler_test_0003';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: blockerUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: targetUid, playAs: 'unit' }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: filler1, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: filler2, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: filler3, playAs: 'unit' }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const blockerUnit = findUnit(gameEnv, 'playerId_1', blockerUid);
        expect(blockerUnit).toBeTruthy();

        const attackEvent = {
            playerId: 'playerId_2',
            data: {
                playerId: 'playerId_2',
                actionType: 'attackUnit',
                attackerCarduid: attackerUid,
                targetUnitUid: targetUid,
                targetPlayerId: 'playerId_1',
                fromBurst: false
            }
        };

        const blockerResult = BlockerChoiceManager.processAttackWithBlockerChoice(gameEnv, attackEvent, 'playerId_1');
        expect(blockerResult.success).toBe(true);
        expect(blockerResult.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.BLOCKER_CHOICE);
        expect(choiceEvent).toBeTruthy();
        expect(choiceEvent.data.availableTargets.some((t) => t.carduid === blockerUid)).toBe(true);
    });

    test('does not gain Blocker when opponent has <=3 units (no blocker choice)', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const blockerUid = 'GD01-019_unit_blocker_test_0002';
        const targetUid = 'GD01-007_unit_target_test_0002';

        const attackerUid = 'GD01-012_unit_attacker_test_0002';
        const filler1 = 'GD01-001_unit_filler_test_0004';
        const filler2 = 'GD01-002_unit_filler_test_0005';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: blockerUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: targetUid, playAs: 'unit' }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: filler1, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: filler2, playAs: 'unit' }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const blockerUnit = findUnit(gameEnv, 'playerId_1', blockerUid);
        expect(blockerUnit).toBeTruthy();

        const attackEvent = {
            playerId: 'playerId_2',
            data: {
                playerId: 'playerId_2',
                actionType: 'attackUnit',
                attackerCarduid: attackerUid,
                targetUnitUid: targetUid,
                targetPlayerId: 'playerId_1',
                fromBurst: false
            }
        };

        const blockerResult = BlockerChoiceManager.processAttackWithBlockerChoice(gameEnv, attackEvent, 'playerId_1');
        expect(blockerResult.success).toBe(true);
        expect(blockerResult.normalAttack).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.BLOCKER_CHOICE);
        expect(choiceEvent).toBeFalsy();
    });
});
