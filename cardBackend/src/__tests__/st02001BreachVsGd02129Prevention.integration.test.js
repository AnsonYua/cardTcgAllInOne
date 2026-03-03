const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { createZoneCard, CardDatabaseManager } = require('../models/CardSystem');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { BattleDestroyEffectManager } = require('../services/effects/BattleDestroyEffectManager');
const gd02 = require('../data/gd02Card.json');

function findUnitAndSlotByCarduid(player, carduid) {
    const slotNames = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
    for (const slotName of slotNames) {
        const unit = player.zones?.[slotName]?.unit;
        if (unit?.carduid === carduid) {
            return { unit, slotName };
        }
    }
    return null;
}

describe('ST02-001 Breach vs GD02-129 prevention integration', () => {
    test('BATTLE_DESTROY breach damageShield is prevented by GD02-129 enemy effect damage prevention', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const attackerUid = 'ST02-001_attacker_0001';
        const destroyedUid = 'GD01-020_destroyed_0001';
        const baseUid = 'GD02-129_base_0003';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: destroyedUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: baseUid,
            playAs: 'base'
        }).success).toBe(true);

        const defender = gameEnv.getPlayer('playerId_2');
        const shieldCardData = CardDatabaseManager.getCardDetails('ST01-001');
        const shieldUid = 'ST01-001_shield_0003';
        defender.zones.shieldArea.push(createZoneCard(shieldUid, 'ST01-001', shieldCardData, 'playerId_2'));

        const deployRule = gd02.cards['GD02-129'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        expect(deployRule).toBeTruthy();
        const deployResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_2',
            baseUid,
            deployRule
        );
        expect(deployResult.success).toBe(true);
        expect(deployResult.requiresSelection).not.toBe(true);

        const attackerPlayer = gameEnv.getPlayer('playerId_1');
        const attackerInfo = findUnitAndSlotByCarduid(attackerPlayer, attackerUid);
        const destroyedInfo = findUnitAndSlotByCarduid(defender, destroyedUid);
        expect(attackerInfo).toBeTruthy();
        expect(destroyedInfo).toBeTruthy();

        const breachResult = BattleDestroyEffectManager.processBattleDestroy(gameEnv, {
            sourcePlayerId: 'playerId_1',
            sourceUnit: attackerInfo.unit,
            sourceSlot: attackerInfo.slotName,
            destroyedPlayerId: 'playerId_2',
            destroyedSlot: destroyedInfo.slotName,
            destroyedUnit: destroyedInfo.unit
        });

        expect(breachResult.success).toBe(true);
        expect(defender.zones.base[0].damageReceived || 0).toBe(0);

        const preventedNotification = gameEnv.notificationQueue.find((event) => event?.type === 'EFFECT_DAMAGE_PREVENTED');
        expect(preventedNotification).toBeTruthy();

        const baseDamagedNotification = gameEnv.notificationQueue.find((event) => event?.type === 'BASE_DAMAGED');
        const baseDestroyedNotification = gameEnv.notificationQueue.find((event) => event?.type === 'BASE_DESTROYED');
        expect(baseDamagedNotification).toBeFalsy();
        expect(baseDestroyedNotification).toBeFalsy();
    });
});
