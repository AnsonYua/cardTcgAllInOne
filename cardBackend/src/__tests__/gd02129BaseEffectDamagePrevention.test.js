const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { createZoneCard, CardDatabaseManager } = require('../models/CardSystem');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const gd02 = require('../data/gd02Card.json');

describe('GD02-129 deploy effect damage prevention', () => {
    test('prevents enemy effect damage to base but not self effect damage', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const baseUid = 'GD02-129_base_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: baseUid,
            playAs: 'base'
        }).success).toBe(true);

        const player = gameEnv.getPlayer('playerId_1');
        const shieldCardData = CardDatabaseManager.getCardDetails('ST01-001');
        const shieldUid = 'ST01-001_shield_0001';
        player.zones.shieldArea.push(createZoneCard(shieldUid, 'ST01-001', shieldCardData, 'playerId_1'));

        const deployRule = gd02.cards['GD02-129'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        expect(deployRule).toBeTruthy();

        const deployResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            baseUid,
            deployRule
        );

        expect(deployResult.success).toBe(true);
        expect(deployResult.requiresSelection).not.toBe(true);
        expect(player.deck.handUids).toContain(shieldUid);

        const damageEffect = {
            effectId: 'test_damage',
            action: 'damage',
            parameters: { value: 2 }
        };

        const enemyDamage = EffectExecutor.applyEffectToTargets(
            gameEnv,
            damageEffect,
            [{ carduid: baseUid, zone: 'base', playerId: 'playerId_1' }],
            'playerId_2',
            'GD01-100_enemy_source_0001'
        );
        expect(enemyDamage.success).toBe(true);
        expect(player.zones.base[0].damageReceived || 0).toBe(0);

        const preventedNotification = gameEnv.notificationQueue.find((event) => event?.type === 'EFFECT_DAMAGE_PREVENTED');
        expect(preventedNotification).toBeTruthy();

        const selfDamage = EffectExecutor.applyEffectToTargets(
            gameEnv,
            damageEffect,
            [{ carduid: baseUid, zone: 'base', playerId: 'playerId_1' }],
            'playerId_1',
            'GD01-100_self_source_0001'
        );
        expect(selfDamage.success).toBe(true);
        expect(player.zones.base[0].damageReceived).toBe(2);
    });
});
