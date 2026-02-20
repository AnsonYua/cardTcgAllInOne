const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');
const { TargetResolver } = require('../services/targets/TargetResolver');

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

    test('resolves <=eventAttackerLevel from current battle context', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'GD01-044_event_attacker_0001';
        const defenderLowUid = 'GD01-001_event_target_low_0001';
        const defenderHighUid = 'GD01-003_event_target_high_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: defenderLowUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: defenderHighUid,
            playAs: 'unit'
        }).success).toBe(true);

        const attacker = findUnit(gameEnv, 'playerId_1', attackerUid);
        const defenderLow = findUnit(gameEnv, 'playerId_2', defenderLowUid);
        const defenderHigh = findUnit(gameEnv, 'playerId_2', defenderHighUid);
        expect(attacker).toBeTruthy();
        expect(defenderLow).toBeTruthy();
        expect(defenderHigh).toBeTruthy();

        attacker.cardData.level = 4;
        defenderLow.cardData.level = 3;
        defenderHigh.cardData.level = 6;

        gameEnv.currentBattle = {
            attackerCarduid: attackerUid,
            targetCarduid: defenderLowUid,
            attackingPlayerId: 'playerId_1',
            defendingPlayerId: 'playerId_2',
            actionType: 'attackUnit'
        };

        const effect = {
            effectId: 'event_level_filter_test',
            type: 'triggered',
            trigger: 'ATTACK_PHASE',
            action: 'rest',
            target: {
                type: 'unit',
                scope: 'opponent',
                count: 99,
                filters: {
                    level: '<=eventAttackerLevel'
                }
            }
        };

        const targetConfig = TargetResolver.resolveTargetConfig(effect);
        const targets = TargetResolver.generateAvailableTargets(gameEnv, 'playerId_1', targetConfig, attackerUid);
        const targetUids = targets.map(t => t.carduid);

        expect(targetUids).toContain(defenderLowUid);
        expect(targetUids).not.toContain(defenderHighUid);
    });
});
