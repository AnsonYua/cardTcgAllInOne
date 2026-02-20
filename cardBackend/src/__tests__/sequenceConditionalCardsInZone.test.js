const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');

function createSequenceConditionalEffect() {
    return {
        effectId: 'test_sequence_cards_in_zone',
        type: 'internal',
        trigger: 'TEST',
        action: 'sequence',
        parameters: {
            steps: [
                {
                    action: 'conditional',
                    parameters: {
                        if: [
                            {
                                type: 'cardsInZone',
                                zone: 'shield',
                                scope: 'opponent',
                                value: '<=3'
                            }
                        ],
                        then: [{ action: 'moveTopDeckToTrash', parameters: { count: 1, reveal: false } }],
                        else: [{ action: 'moveTopDeckToTrash', parameters: { count: 2, reveal: false } }]
                    }
                }
            ]
        }
    };
}

describe('Sequence conditional (cardsInZone)', () => {
    test('then branch runs when opponent shield count satisfies cardsInZone condition', () => {
        const gameEnv = new GameEnvironment();
        const player1 = gameEnv.addPlayer('playerId_1', 'P1');
        const player2 = gameEnv.addPlayer('playerId_2', 'P2');

        player1.deck.mainDeck = ['GD02-001_draw_0001', 'GD02-002_draw_0002', 'GD02-003_draw_0003'];
        player1.zones.trashArea = [];
        player2.zones.shieldArea = [{ carduid: 's1' }, { carduid: 's2' }, { carduid: 's3' }];

        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'SRC',
            createSequenceConditionalEffect()
        );

        expect(result.success).toBe(true);
        expect(player1.zones.trashArea).toHaveLength(1);
        expect(player1.deck.mainDeck).toHaveLength(2);
    });

    test('else branch runs when opponent shield count fails cardsInZone condition', () => {
        const gameEnv = new GameEnvironment();
        const player1 = gameEnv.addPlayer('playerId_1', 'P1');
        const player2 = gameEnv.addPlayer('playerId_2', 'P2');

        player1.deck.mainDeck = ['GD02-001_draw_0001', 'GD02-002_draw_0002', 'GD02-003_draw_0003'];
        player1.zones.trashArea = [];
        player2.zones.shieldArea = [{ carduid: 's1' }, { carduid: 's2' }, { carduid: 's3' }, { carduid: 's4' }];

        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'SRC',
            createSequenceConditionalEffect()
        );

        expect(result.success).toBe(true);
        expect(player1.zones.trashArea).toHaveLength(2);
        expect(player1.deck.mainDeck).toHaveLength(1);
    });
});
