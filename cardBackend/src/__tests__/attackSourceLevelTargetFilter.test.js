const { GameEnvironment } = require('../models/GameEnvironment');
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

describe('TargetResolver dynamic level filters', () => {
    test('resolves <=SOURCE_LEVEL when selecting attack-phase targets', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUnitUid = 'GD01-044_unit_test_0001';
        const attackerPilotUid = 'GD01-093_pilot_test_0001';
        const defenderLowLevelUid = 'GD01-001_enemy_test_0001';
        const defenderHighLevelUid = 'GD01-003_enemy_test_0001';

        const placedAttackerUnit = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerUnitUid,
            playAs: 'unit'
        });
        expect(placedAttackerUnit.success).toBe(true);

        const placedAttackerPilot = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerPilotUid,
            playAs: 'pilot',
            targetUnit: attackerUnitUid
        });
        expect(placedAttackerPilot.success).toBe(true);

        const placedDefenderLow = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: defenderLowLevelUid,
            playAs: 'unit'
        });
        expect(placedDefenderLow.success).toBe(true);

        const placedDefenderHigh = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: defenderHighLevelUid,
            playAs: 'unit'
        });
        expect(placedDefenderHigh.success).toBe(true);

        const low = findUnit(gameEnv, 'playerId_2', defenderLowLevelUid);
        const high = findUnit(gameEnv, 'playerId_2', defenderHighLevelUid);
        expect(low).toBeTruthy();
        expect(high).toBeTruthy();

        low.damageReceived = 0;
        high.damageReceived = 0;

        const attackEvent = {
            playerId: 'playerId_1',
            data: {
                playerId: 'playerId_1',
                actionType: 'attackShieldArea',
                attackerCarduid: attackerUnitUid,
                fromBurst: false
            }
        };

        const result = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, attackEvent);
        expect(result.success).toBe(true);

        // Pilot effect: target enemy Unit with Lv. <= SOURCE_LEVEL (pilot level 4)
        expect(low.damageReceived).toBe(1);
        expect(high.damageReceived).toBe(0);
    });
});
