const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { TargetResolver } = require('../services/targets/TargetResolver');
const { EffectConditionEvaluator } = require('../services/conditions/EffectConditionEvaluator');
const { SlotZoneUtils } = require('../utils/SlotZoneUtils');

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
    test('resolves <=SOURCE_LEVEL with default sourceLevelScope (paired_unit) when source is pilot', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUnitUid = 'GD03-009_unit_test_0001';
        const attackerPilotUid = 'GD01-093_pilot_test_0001';
        const defenderLowLevelUid = 'GD01-001_enemy_test_0001'; // level 4
        const defenderBoundaryLevelUid = 'GD01-044_enemy_test_0001'; // level 5

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
            carduid: defenderBoundaryLevelUid,
            playAs: 'unit'
        });
        expect(placedDefenderHigh.success).toBe(true);

        const low = findUnit(gameEnv, 'playerId_2', defenderLowLevelUid);
        const boundary = findUnit(gameEnv, 'playerId_2', defenderBoundaryLevelUid);
        expect(low).toBeTruthy();
        expect(boundary).toBeTruthy();

        // GD01-093 attack_effect uses filters.level <= SOURCE_LEVEL.
        const pilotRules = SlotZoneUtils.getCardByUid(gameEnv, attackerPilotUid).cardData.effects.rules;
        const attackEffect = pilotRules.find((rule) => rule.effectId === 'attack_effect');
        expect(attackEffect).toBeTruthy();

        const targetConfig = TargetResolver.resolveTargetConfig(attackEffect);
        const targets = TargetResolver.generateAvailableTargets(gameEnv, 'playerId_1', targetConfig, attackerPilotUid);
        const targetUids = targets.map((t) => t.carduid);

        // With new semantics, SOURCE_LEVEL resolves to paired unit level (GD03-009 level 5).
        expect(targetUids).toContain(defenderLowLevelUid);
        expect(targetUids).toContain(defenderBoundaryLevelUid);
    });

    test('resolves <=SOURCE_LEVEL from pilot level when sourceLevelScope=source_card', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUnitUid = 'GD03-009_unit_scope_test_0001'; // level 5
        const attackerPilotUid = 'GD01-093_pilot_scope_test_0001'; // level 4
        const defenderLevel4Uid = 'GD01-001_enemy_scope_test_0001';
        const defenderLevel5Uid = 'GD01-044_enemy_scope_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerUnitUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerPilotUid,
            playAs: 'pilot',
            targetUnit: attackerUnitUid
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: defenderLevel4Uid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: defenderLevel5Uid,
            playAs: 'unit'
        }).success).toBe(true);

        const sourcePilot = SlotZoneUtils.getCardByUid(gameEnv, attackerPilotUid);
        const attackEffect = sourcePilot.cardData.effects.rules.find((rule) => rule.effectId === 'attack_effect');
        expect(attackEffect).toBeTruthy();
        attackEffect.sourceLevelScope = 'source_card';

        const targetConfig = TargetResolver.resolveTargetConfig(attackEffect);
        const targets = TargetResolver.generateAvailableTargets(gameEnv, 'playerId_1', targetConfig, attackerPilotUid);
        const targetUids = targets.map((t) => t.carduid);

        expect(targetUids).toContain(defenderLevel4Uid);
        expect(targetUids).not.toContain(defenderLevel5Uid);
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

    test('sourceLevel condition uses paired unit level for paired pilot source', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const sourceUnitUid = 'GD01-044_source_unit_0001'; // level 5
        const sourcePilotUid = 'GD02-095_source_pilot_0001'; // sourceLevel <= 5

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: sourceUnitUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: sourcePilotUid,
            playAs: 'pilot',
            targetUnit: sourceUnitUid
        }).success).toBe(true);

        const sourceUnit = findUnit(gameEnv, 'playerId_1', sourceUnitUid);
        expect(sourceUnit).toBeTruthy();
        sourceUnit.damageReceived = 1;

        const sourcePilot = SlotZoneUtils.getCardByUid(gameEnv, sourcePilotUid);
        const attackEffect = sourcePilot.cardData.effects.rules.find((rule) => rule.effectId === 'attack_effect');
        expect(attackEffect).toBeTruthy();

        // Unit level 5 and damaged => condition should pass.
        expect(
            EffectConditionEvaluator.validateEffectConditions(
                attackEffect,
                gameEnv,
                'playerId_1',
                sourcePilot
            )
        ).toBe(true);

        // Raise paired unit level above threshold => condition should fail.
        sourceUnit.cardData.level = 6;
        expect(
            EffectConditionEvaluator.validateEffectConditions(
                attackEffect,
                gameEnv,
                'playerId_1',
                sourcePilot
            )
        ).toBe(false);
    });

    test('sourceLevel condition uses pilot level when sourceLevelScope=source_card', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const sourceUnitUid = 'GD01-044_source_scope_unit_0001'; // level 5
        const sourcePilotUid = 'GD02-095_source_scope_pilot_0001'; // level 4

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: sourceUnitUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: sourcePilotUid,
            playAs: 'pilot',
            targetUnit: sourceUnitUid
        }).success).toBe(true);

        const sourceUnit = findUnit(gameEnv, 'playerId_1', sourceUnitUid);
        sourceUnit.damageReceived = 1;

        const sourcePilot = SlotZoneUtils.getCardByUid(gameEnv, sourcePilotUid);
        const attackEffect = sourcePilot.cardData.effects.rules.find((rule) => rule.effectId === 'attack_effect');
        expect(attackEffect).toBeTruthy();
        attackEffect.sourceLevelScope = 'source_card';

        // Pilot level 4 and condition <=5 => pass, regardless of paired unit level.
        expect(
            EffectConditionEvaluator.validateEffectConditions(
                attackEffect,
                gameEnv,
                'playerId_1',
                sourcePilot
            )
        ).toBe(true);

        // Make pilot level exceed threshold => fail.
        sourcePilot.cardData.level = 6;
        expect(
            EffectConditionEvaluator.validateEffectConditions(
                attackEffect,
                gameEnv,
                'playerId_1',
                sourcePilot
            )
        ).toBe(false);
    });

    test('sourceLevel condition default paired_unit falls back to pilot level when unpaired', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const sourceUnitUid = 'GD01-044_source_unpaired_unit_0001';
        const sourcePilotUid = 'GD02-095_source_unpaired_pilot_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: sourceUnitUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: sourcePilotUid,
            playAs: 'pilot',
            targetUnit: sourceUnitUid
        }).success).toBe(true);

        const slot = gameEnv.getPlayer('playerId_1').zones.slot1;
        slot.unit = null;

        const sourcePilot = SlotZoneUtils.getCardByUid(gameEnv, sourcePilotUid);
        sourcePilot.damageReceived = 1;
        const attackEffect = sourcePilot.cardData.effects.rules.find((rule) => rule.effectId === 'attack_effect');
        expect(attackEffect).toBeTruthy();

        // Unpaired pilot fallback should use source-card level.
        sourcePilot.cardData.level = 4;
        expect(
            EffectConditionEvaluator.validateEffectConditions(
                attackEffect,
                gameEnv,
                'playerId_1',
                sourcePilot
            )
        ).toBe(true);

        sourcePilot.cardData.level = 6;
        expect(
            EffectConditionEvaluator.validateEffectConditions(
                attackEffect,
                gameEnv,
                'playerId_1',
                sourcePilot
            )
        ).toBe(false);
    });
});
