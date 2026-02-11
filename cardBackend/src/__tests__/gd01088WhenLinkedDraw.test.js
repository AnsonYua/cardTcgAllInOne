const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');

describe('GD01-088 Banagher Links', () => {
    test('draws 1 on PAIRING_COMPLETE when linked', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        const drawnCarduid = 'GD01-021_draw_test_0001';
        player.deck.mainDeck = [drawnCarduid];

        const unitUid = 'GD01-005_unit_test_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success).toBe(true);

        const pilotUid = 'GD01-088_pilot_test_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: pilotUid, playAs: 'pilot', targetUnit: unitUid }).success).toBe(true);

        const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(
            { playerId: 'playerId_1', carduid: pilotUid, playAs: 'pilot', targetUnit: unitUid },
            gameEnv,
            'playerId_1'
        );
        expect(pairingEvent).toBeTruthy();

        const beforeHand = [...player.deck.handUids];
        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', pairingEvent.data);
        expect(result.success).toBe(true);

        expect(player.deck.mainDeck.length).toBe(0);
        expect(player.deck.handUids).toEqual([...beforeHand, drawnCarduid]);
    });
});

