const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { EventType } = require('../services/EventQueue/interfaces/GameEvent');

describe('GD02-087 Orga, Crot, and Shani pairing effect', () => {
    test('linked pairing rests an enemy Blocker when paired unit is blue', () => {
        const gameEnv = new GameEnvironment();
        const enemy = gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        const enemyBlockerUid = 'GD02-006_blocker_enemy_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, enemy.id, {
                carduid: enemyBlockerUid,
                playAs: 'unit'
            }).success
        ).toBe(true);

        const unitUid = 'GD02-010_unit_owner_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
                carduid: unitUid,
                playAs: 'unit'
            }).success
        ).toBe(true);

        const pilotUid = 'GD02-087_pilot_owner_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
                carduid: pilotUid,
                playAs: 'pilot',
                targetUnit: unitUid
            }).success
        ).toBe(true);

        const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(
            { playerId: owner.id, carduid: pilotUid, playAs: 'pilot', targetUnit: unitUid },
            gameEnv,
            owner.id
        );
        expect(pairingEvent).toBeTruthy();

        const result = PairingEffectManager.processPairingEffect(gameEnv, owner.id, pairingEvent.data);
        expect(result.success).toBe(true);

        const targetChoice = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(targetChoice).toBeFalsy();

        expect(enemy.zones.slot1.unit.isRested).toBe(true);
    });
});
