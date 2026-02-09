const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');

describe('Sequence conditional (milledAnyCardHasTrait)', () => {
    test('conditional then-steps run when milled cards include trait', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        // Top 2 include a (Vagan) card: GD02-057 has trait Vagan; GD02-058 does not.
        player.deck.mainDeck = [
            'GD02-057_draw_00012',
            'GD02-058_draw_00021',
            'GD02-066_draw_00021'
        ];

        player.zones.trashArea = [];

        const effect = {
            effectId: 'test_sequence',
            type: 'internal',
            trigger: 'TEST',
            action: 'sequence',
            parameters: {
                steps: [
                    {
                        stepId: 'mill2',
                        action: 'moveTopDeckToTrash',
                        parameters: { count: 2, reveal: false }
                    },
                    {
                        action: 'conditional',
                        parameters: {
                            if: [{ type: 'milledAnyCardHasTrait', stepId: 'mill2', trait: 'Vagan' }],
                            then: [{ action: 'moveTopDeckToTrash', parameters: { count: 1, reveal: false } }]
                        }
                    }
                ]
            }
        };

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, 'playerId_1', 'SRC', effect);
        expect(result.success).toBe(true);
        expect(player.zones.trashArea).toHaveLength(3);
        expect(player.deck.mainDeck).toHaveLength(0);
    });
});

