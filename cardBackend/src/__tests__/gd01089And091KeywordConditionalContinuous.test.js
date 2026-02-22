const gd01 = require('../data/gd01Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { BattleDamagePreventionUtils } = require('../services/battle/BattleDamagePreventionUtils');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    for (let i = 1; i <= 6; i++) {
        const slot = player.zones[`slot${i}`];
        if (slot && slot.unit && slot.unit.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

describe('GD01-089/GD01-091 conditional keyword continuous effects', () => {
    test('card data includes missing continuous rules for GD01-089 and GD01-091', () => {
        const gd01089 = gd01.cards['GD01-089'];
        expect(gd01089.effects.description).toHaveLength(2);
        expect(gd01089.effects.rules).toHaveLength(2);
        const rule089 = gd01089.effects.rules.find((rule) => rule.effectId === 'continuous_ap_plus_1_if_unit_has_repair');
        expect(rule089).toBeTruthy();
        expect(rule089.action).toBe('modifyAP');
        expect(rule089.trigger).toBe('continuous');
        expect(rule089.target?.filters?.keywords).toEqual(['Repair']);

        const gd01091 = gd01.cards['GD01-091'];
        expect(gd01091.effects.description).toHaveLength(2);
        expect(gd01091.effects.rules).toHaveLength(2);
        const rule091 = gd01091.effects.rules.find((rule) => rule.effectId === 'continuous_prevent_battle_damage_if_unit_has_breach_during_your_turn');
        expect(rule091).toBeTruthy();
        expect(rule091.action).toBe('prevent_battle_damage');
        expect(rule091.trigger).toBe('continuous');
        expect(rule091.target?.filters?.keywords).toEqual(['Breach']);
        expect(rule091.parameters?.maxEnemyAp).toBe(3);
    });

    test('GD01-089 grants AP+1 only when paired unit has Repair', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const repairUnitUid = 'GD01-004_repair_unit_0001';
        const nonRepairUnitUid = 'GD01-027_non_repair_unit_0001';
        const repairPilotUid = 'GD01-089_pilot_0001';
        const nonRepairPilotUid = 'GD01-089_pilot_0002';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: repairUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: nonRepairUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: repairPilotUid, playAs: 'pilot', targetUnit: repairUnitUid }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: nonRepairPilotUid, playAs: 'pilot', targetUnit: nonRepairUnitUid }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const repairUnit = findUnit(gameEnv, 'playerId_1', repairUnitUid);
        const nonRepairUnit = findUnit(gameEnv, 'playerId_1', nonRepairUnitUid);
        expect(repairUnit.continueModifyAP || 0).toBe(1);
        expect(nonRepairUnit.continueModifyAP || 0).toBe(0);
    });

    test('GD01-091 battle-damage prevention applies only on your turn when paired unit has Breach', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        const breachUnitUid = 'GD01-027_breach_unit_0001';
        const pilotUid = 'GD01-091_pilot_0001';
        const enemyUnitUid = 'GD01-001_enemy_low_ap_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: breachUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: pilotUid, playAs: 'pilot', targetUnit: breachUnitUid }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyUnitUid, playAs: 'unit' }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const protectedUnit = findUnit(gameEnv, 'playerId_1', breachUnitUid);
        const enemyUnit = findUnit(gameEnv, 'playerId_2', enemyUnitUid);
        const enemyStats = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, enemyUnitUid);

        expect(BattleDamagePreventionUtils.isBattleDamagePrevented(protectedUnit, enemyUnit, enemyStats.totalAP || 0)).toBe(true);

        gameEnv.currentPlayer = 'playerId_2';
        ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(BattleDamagePreventionUtils.isBattleDamagePrevented(protectedUnit, enemyUnit, enemyStats.totalAP || 0)).toBe(false);
    });
});
