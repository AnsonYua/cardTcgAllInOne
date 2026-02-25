const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');

describe('Sequence step actionTurn gating', () => {
    test('skips step when timing.actionTurn does not match current turn', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_2';
        p1.deck.mainDeck = ['GD01-001_draw_0001'];

        const effect = {
            effectId: 'test_sequence_action_turn_gate',
            type: 'internal',
            trigger: 'TEST',
            action: 'sequence',
            parameters: {
                steps: [
                    {
                        action: 'draw',
                        timing: { actionTurn: 'YOUR_TURN' },
                        parameters: { value: 1 }
                    }
                ]
            }
        };

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, 'playerId_1', 'SRC', effect);
        expect(result.success).toBe(true);
        expect(p1.deck.mainDeck).toHaveLength(1);
        expect(p1.deck.handUids).toHaveLength(0);
    });

    test('executes step when timing.actionTurn matches current turn', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';
        p1.deck.mainDeck = ['GD01-001_draw_0002'];

        const effect = {
            effectId: 'test_sequence_action_turn_gate_positive',
            type: 'internal',
            trigger: 'TEST',
            action: 'sequence',
            parameters: {
                steps: [
                    {
                        action: 'draw',
                        timing: { actionTurn: 'YOUR_TURN' },
                        parameters: { value: 1 }
                    }
                ]
            }
        };

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, 'playerId_1', 'SRC', effect);
        expect(result.success).toBe(true);
        expect(p1.deck.mainDeck).toHaveLength(0);
        expect(p1.deck.handUids).toHaveLength(1);
    });

    test('fails fast when sequence contains unsupported step action', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const effect = {
            effectId: 'test_sequence_action_unsupported_step',
            type: 'internal',
            trigger: 'TEST',
            action: 'sequence',
            parameters: {
                steps: [
                    {
                        action: 'drawx',
                        parameters: { value: 1 }
                    }
                ]
            }
        };

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, 'playerId_1', 'SRC', effect);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Unsupported sequence step action 'drawx'/);
    });
});
