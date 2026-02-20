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

describe('paired_titans_shield_damage_heal_2 targeting', () => {
    test('skips when trigger conditions are not satisfied and does not create TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const sourceCarduid = 'GD02-001_unit_test_0001';
        const otherCarduid = 'GD02-007_unit_test_0001';

        const placedSource = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: sourceCarduid,
            playAs: 'unit'
        });
        expect(placedSource.success).toBe(true);

        const placedOther = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: otherCarduid,
            playAs: 'unit'
        });
        expect(placedOther.success).toBe(true);

        const sourceUnit = findUnit(gameEnv, 'playerId_1', sourceCarduid);
        expect(sourceUnit).toBeTruthy();

        // Make the healing observable.
        sourceUnit.damageReceived = 2;

        const beforeHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, sourceCarduid).totalHP;

        const rules = sourceUnit.cardData?.effects?.rules || [];
        const healEffect = rules.find((rule) => rule.effectId === 'paired_titans_shield_damage_heal_2');
        expect(healEffect).toBeTruthy();
        expect(healEffect.target.scope).toBe('source');

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            sourceCarduid,
            healEffect
        );
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        const afterHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, sourceCarduid).totalHP;
        expect(afterHp).toBe(beforeHp);
    });
});
