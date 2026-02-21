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

describe('GD02-072 conditional repair completion', () => {
    test('heals only when a friendly white base is in play', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const unitUid = 'GD02-072_repair_test_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: unitUid,
            playAs: 'unit'
        }).success).toBe(true);

        const sourceUnit = findUnit(gameEnv, 'playerId_1', unitUid);
        expect(sourceUnit).toBeTruthy();
        sourceUnit.damageReceived = 2;

        const repairRule = (sourceUnit.cardData?.effects?.rules || [])
            .find((r) => r.effectId === 'repair_1_if_friendly_white_base');
        expect(repairRule).toBeTruthy();
        expect(repairRule.conditions?.[0]?.type).toBe('cardsInPlayWithFilter');

        const beforeNoBaseHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, unitUid).totalHP;
        const noBaseResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            unitUid,
            repairRule
        );
        expect(noBaseResult.success).toBe(true);
        const afterNoBaseHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, unitUid).totalHP;
        expect(afterNoBaseHp).toBe(beforeNoBaseHp);

        p1.zones.base.push({
            carduid: 'base_white_0001',
            cardId: 'TEST-WHITE-BASE',
            cardData: {
                cardType: 'base',
                color: 'White',
                name: 'Test White Base'
            },
            isRested: false
        });

        const beforeWithBaseHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, unitUid).totalHP;
        const withBaseResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            unitUid,
            repairRule
        );
        expect(withBaseResult.success).toBe(true);
        const afterWithBaseHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, unitUid).totalHP;
        expect(afterWithBaseHp).toBe(beforeWithBaseHp + 1);
    });
});
