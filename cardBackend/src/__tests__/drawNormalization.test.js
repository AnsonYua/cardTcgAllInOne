const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');

describe('Draw normalization', () => {
    test('drawCardsIntoHand accepts string carduid entries', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.deck.mainDeck = ['ST01-004_string_0001'];

        EffectExecutor.drawCardsIntoHand(gameEnv, 'playerId_1', player.deck, 1, { notify: false });

        expect(player.deck.handUids).toContain('ST01-004_string_0001');
    });

    test('drawCardsIntoHand accepts object deck entries with carduid', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.deck.mainDeck = [{ carduid: 'ST01-004_object_0001', cardId: 'ST01-004' }];

        EffectExecutor.drawCardsIntoHand(gameEnv, 'playerId_1', player.deck, 1, { notify: false });

        expect(player.deck.handUids).toContain('ST01-004_object_0001');
        expect(player.deck.handUids.every((uid) => typeof uid === 'string')).toBe(true);
    });

    test('drawCardsIntoHand throws on invalid object deck entries', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.deck.mainDeck = [{ cardId: 'ST01-004' }];

        expect(() => {
            EffectExecutor.drawCardsIntoHand(gameEnv, 'playerId_1', player.deck, 1, { notify: false });
        }).toThrow('Invalid deck entry while drawing');
    });
});
