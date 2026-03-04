const { GameEnvironment } = require('../models/GameEnvironment');
const { HandZoneManager } = require('../services/zones/HandZoneManager');

function latestAddToHandNotification(gameEnv) {
    return (gameEnv.notificationQueue || [])
        .slice()
        .reverse()
        .find((note) => note.type === 'CARD_ADDED_TO_HAND');
}

describe('HandZoneManager add-to-hand visibility contract', () => {
    test('defaults revealToOpponent=true for trash-to-hand', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const result = HandZoneManager.addCardToHand(
            gameEnv,
            'playerId_1',
            'GD01-118_trash_contract_0001',
            { id: 'GD01-118', name: 'Overflowing Affection' },
            { sourceZone: 'trash' }
        );

        expect(result.success).toBe(true);
        const note = latestAddToHandNotification(gameEnv);
        expect(note).toBeTruthy();
        expect(note.payload.sourceZone).toBe('trash');
        expect(note.payload.revealToOpponent).toBe(true);
    });

    test('defaults revealToOpponent=false for deck-to-hand add notifications', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const result = HandZoneManager.addCardToHand(
            gameEnv,
            'playerId_1',
            'GD01-118_deck_contract_0001',
            { id: 'GD01-118', name: 'Overflowing Affection' },
            { sourceZone: 'deck' }
        );

        expect(result.success).toBe(true);
        const note = latestAddToHandNotification(gameEnv);
        expect(note).toBeTruthy();
        expect(note.payload.sourceZone).toBe('deck');
        expect(note.payload.revealToOpponent).toBe(false);
    });

    test('respects explicit revealToOpponent override in extraPayload', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const result = HandZoneManager.addCardToHand(
            gameEnv,
            'playerId_1',
            'GD01-118_trash_contract_0002',
            { id: 'GD01-118', name: 'Overflowing Affection' },
            {
                sourceZone: 'trash',
                extraPayload: {
                    revealToOpponent: false
                }
            }
        );

        expect(result.success).toBe(true);
        const note = latestAddToHandNotification(gameEnv);
        expect(note).toBeTruthy();
        expect(note.payload.sourceZone).toBe('trash');
        expect(note.payload.revealToOpponent).toBe(false);
    });
});
