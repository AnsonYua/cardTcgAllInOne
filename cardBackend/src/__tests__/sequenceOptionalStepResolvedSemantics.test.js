const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');

function createChoiceEvent(context, effect, playerId = 'playerId_1', sourceCarduid = 'SRC') {
    return {
        id: 'choice_event_test',
        type: 'TARGET_CHOICE',
        playerId,
        data: {
            sourceCarduid,
            effect,
            context
        }
    };
}

describe('Sequence optional stepResolved semantics', () => {
    test('does not mark resolveKey when optional step is declined', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const event = createChoiceEvent(
            {
                kind: 'SEQUENCE_CONTINUATION_AFTER_CHOICE',
                playerId: 'playerId_1',
                sourceCarduid: 'SRC',
                remainingSteps: [],
                resolveKey: 'discard_red_card',
                ctx: {
                    movedCards: [],
                    resolvedStepIds: [],
                    previousTargets: []
                }
            },
            {
                effectId: 'discard_red_card',
                type: 'internal',
                trigger: 'SEQUENCE_STEP',
                optional: true,
                action: 'discardFromHand',
                target: { type: 'card', scope: 'self_hand', count: 1 }
            }
        );

        const result = SequenceTargetChoiceHandler.tryHandle(gameEnv, event, []);
        expect(result.handled).toBe(true);
        expect(result.success).toBe(true);

        const continuation = gameEnv.processingQueue.find((queued) => queued.type === 'PLAYER_ACTION');
        expect(continuation).toBeTruthy();
        expect(continuation.data.actionType).toBe('continueSequence');
        expect(continuation.data.sequence.ctx.resolvedStepIds).toEqual([]);
    });
});
