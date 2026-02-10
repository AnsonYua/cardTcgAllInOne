const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');

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

describe('Repair targeting', () => {
    test('Repair effects target the source unit (no TARGET_CHOICE)', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const repairUnitUid = 'GD02-007_unit_repair_test_0001';
        const otherUnitUid = 'GD02-001_unit_other_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: repairUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: otherUnitUid, playAs: 'unit' }).success).toBe(true);

        const unit = findUnit(gameEnv, 'playerId_1', repairUnitUid);
        expect(unit).toBeTruthy();
        unit.damageReceived = 2;

        const beforeHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, repairUnitUid).totalHP;

        const repairRule = (unit.cardData?.effects?.rules || []).find((r) => r.effectId === 'repair_2');
        expect(repairRule).toBeTruthy();
        expect(repairRule.target.scope).toBe('source');

        const result = DeployTargetManager.processEffectWithTargetChoice(gameEnv, 'playerId_1', repairUnitUid, repairRule);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        const afterHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, repairUnitUid).totalHP;
        expect(afterHp).toBe(beforeHp + 2);
    });

    test('Repair data does not force player_choice selection', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const repairUnitUid = 'GD01-004_unit_repair_test_0001';
        const otherUnitUid = 'GD01-006_unit_other_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: repairUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: otherUnitUid, playAs: 'unit' }).success).toBe(true);

        const unit = findUnit(gameEnv, 'playerId_1', repairUnitUid);
        expect(unit).toBeTruthy();
        unit.damageReceived = 1;

        const repairRule = (unit.cardData?.effects?.rules || []).find((r) => r.effectId === 'repair_1');
        expect(repairRule).toBeTruthy();
        expect(repairRule.target.scope).toBe('source');
        expect(repairRule.target.selection).toBeUndefined();

        const result = DeployTargetManager.processEffectWithTargetChoice(gameEnv, 'playerId_1', repairUnitUid, repairRule);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
    });
});
