const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');

describe('addToHand transfer semantics', () => {
    test('moves selected trash card to hand and removes it from trash', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const trashCarduid = 'GD01-109_trash_pick_0001';
        player.zones.trashArea.push({
            carduid: trashCarduid,
            cardId: 'GD01-109',
            cardData: {
                id: 'GD01-109',
                name: 'The Path to Victory or Defeat',
                cardType: 'command',
                level: 5,
                cost: 1,
                color: 'Green',
                effects: { rules: [] },
            },
        });

        const effect = {
            effectId: 'trash_to_hand',
            type: 'triggered',
            trigger: 'PAIRING_COMPLETE',
            action: 'addToHand',
            target: {
                type: 'card',
                scope: 'self_trash',
                count: 1,
            },
            parameters: {
                from: 'trash',
            },
        };

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            effect,
            [
                {
                    carduid: trashCarduid,
                    zone: 'trash',
                    playerId: 'playerId_1',
                    cardData: player.zones.trashArea[0].cardData,
                },
            ],
            'playerId_1',
            'GD01-001_source_0001',
        );

        expect(result.success).toBe(true);
        expect(player.zones.trashArea.some((c) => c.carduid === trashCarduid)).toBe(false);
        expect(player.deck._handUids.includes(trashCarduid)).toBe(true);
    });
});

