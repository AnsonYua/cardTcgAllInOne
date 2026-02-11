const { GameEnvironment } = require('../models/GameEnvironment');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { ChoiceNotificationEmitter } = require('../services/notifications/ChoiceNotificationEmitter');

describe('TARGET_CHOICE notification indicator', () => {
    test('adds choiceKind + choice fields for discardFromHand', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_2', 'P2');

        const effect = {
            effectId: 'sequence_discard',
            type: 'internal',
            trigger: 'SEQUENCE_STEP',
            action: 'discardFromHand',
            target: {
                type: 'card',
                scope: 'self_hand',
                count: 1,
                selection: { type: 'player_choice' }
            },
            parameters: { value: 1 }
        };

        const choiceEvent = EventFactory.createTargetChoiceEvent({
            playerId: 'playerId_2',
            sourceCarduid: 'GD01-005_unit_0001',
            effect,
            availableTargets: [{ carduid: 'c1', zone: 'hand', playerId: 'playerId_2' }]
        });

        ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, choiceEvent);

        const notif = Array.isArray(gameEnv.notificationQueue)
            ? gameEnv.notificationQueue.find((e) => e && e.id === choiceEvent.id && e.type === 'TARGET_CHOICE')
            : undefined;
        expect(notif).toBeTruthy();
        expect(notif.payload.choiceKind).toBe('DISCARD_FROM_HAND');
        expect(notif.payload.choice.action).toBe('discardFromHand');
        expect(notif.payload.choice.effectId).toBe('sequence_discard');
        expect(notif.payload.choice.sourceCarduid).toBe('GD01-005_unit_0001');
    });
});

