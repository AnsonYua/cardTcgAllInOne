const { GameEnvironment } = require('../models/GameEnvironment');
const { applyPairFromHandEffect } = require('../services/effects/actions/EffectPairActions');

describe('pair_from_hand effect action', () => {
    test('pairs selected hand pilot to source unit slot', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player1', 'P1');
        gameEnv.addPlayer('player2', 'P2');
        gameEnv.currentPlayer = 'player1';

        const player1 = gameEnv.getPlayer('player1');
        const player2 = gameEnv.getPlayer('player2');
        expect(player1).toBeTruthy();
        expect(player2).toBeTruthy();

        const sourceUnit = {
            carduid: 'GD02-071_source_1',
            cardId: 'GD02-071',
            cardData: {
                cardType: 'unit',
                name: 'Source Unit',
                level: 4,
                effects: { rules: [] }
            },
            isRested: false,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: []
        };

        player1.zones.slot1.unit = sourceUnit;

        const pilotInHand = {
            carduid: 'ST03-011_hand_1',
            cardId: 'ST03-011'
        };
        player1.deck._handUids.push(pilotInHand.carduid);

        const effect = {
            effectId: 'test_pair_from_hand',
            action: 'pair_from_hand'
        };

        const result = applyPairFromHandEffect(
            gameEnv,
            'player1',
            sourceUnit.carduid,
            effect,
            [
                {
                    carduid: pilotInHand.carduid,
                    zone: 'hand',
                    playerId: 'player1',
                    cardData: player1.deck.hand.find((c) => c.carduid === pilotInHand.carduid)?.cardData
                }
            ]
        );

        expect(result.success).toBe(true);
        expect(player1.deck.hand.some((c) => c.carduid === pilotInHand.carduid)).toBe(false);
        expect(player1.zones.slot1.pilot).toBeTruthy();
        expect(player1.zones.slot1.pilot.carduid).toBe(pilotInHand.carduid);
    });
});
