const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');

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

describe('GD03-003 repair completion', () => {
    test('has repair rule and heals source by 1', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const unitUid = 'GD03-003_repair_test_0001';
        const otherUnitUid = 'GD03-004_other_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: unitUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: otherUnitUid,
            playAs: 'unit'
        }).success).toBe(true);

        const sourceUnit = findUnit(gameEnv, 'playerId_1', unitUid);
        const otherUnit = findUnit(gameEnv, 'playerId_1', otherUnitUid);
        expect(sourceUnit).toBeTruthy();
        expect(otherUnit).toBeTruthy();

        sourceUnit.damageReceived = 2;
        otherUnit.damageReceived = 2;

        const beforeSourceHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, unitUid).totalHP;
        const beforeOtherHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, otherUnitUid).totalHP;

        const repairRule = (sourceUnit.cardData?.effects?.rules || []).find((r) => r.effectId === 'repair_1');
        expect(repairRule).toBeTruthy();
        expect(repairRule.action).toBe('heal');
        expect(repairRule.trigger).toBe('END_OF_TURN');
        expect(repairRule.target.scope).toBe('source');

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            unitUid,
            repairRule
        );
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const afterSourceHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, unitUid).totalHP;
        const afterOtherHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, otherUnitUid).totalHP;

        expect(afterSourceHp).toBe(beforeSourceHp + 1);
        expect(afterOtherHp).toBe(beforeOtherHp);
    });
});
