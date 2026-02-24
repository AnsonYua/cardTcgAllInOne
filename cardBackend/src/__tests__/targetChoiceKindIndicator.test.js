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

    test('adds PAIR_FROM_HAND choiceKind for pair_from_hand action', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const effect = {
            effectId: 'deploy_pair_from_hand',
            type: 'triggered',
            trigger: 'ENTERS_PLAY',
            action: 'pair_from_hand',
            target: {
                type: 'pilot',
                scope: 'self_hand',
                count: 1,
                selection: { type: 'player_choice' }
            }
        };

        const choiceEvent = EventFactory.createTargetChoiceEvent({
            playerId: 'playerId_1',
            sourceCarduid: 'GD02-071_source_0001',
            effect,
            availableTargets: [{ carduid: 'pilot_1', zone: 'hand', playerId: 'playerId_1' }]
        });

        ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, choiceEvent);

        const notif = Array.isArray(gameEnv.notificationQueue)
            ? gameEnv.notificationQueue.find((e) => e && e.id === choiceEvent.id && e.type === 'TARGET_CHOICE')
            : undefined;
        expect(notif).toBeTruthy();
        expect(notif.payload.choiceKind).toBe('PAIR_FROM_HAND');
        expect(notif.payload.choice.action).toBe('pair_from_hand');
    });

    test('sync updates choiceKind/contextKind when sequence context is attached after creation', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const effect = {
            effectId: 'grant_keyword',
            type: 'internal',
            trigger: 'SEQUENCE_STEP',
            optional: true,
            action: 'grant_keyword',
            target: {
                type: 'unit',
                scope: 'self_all_unit',
                count: 1,
                selection: { type: 'player_choice' }
            },
            parameters: { keyword: 'Blocker' }
        };

        const choiceEvent = EventFactory.createTargetChoiceEvent({
            playerId: 'playerId_1',
            sourceCarduid: 'GD03-118_hand_0001',
            effect,
            availableTargets: [{ carduid: 'u1', zone: 'slot1', playerId: 'playerId_1' }]
        });

        ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, choiceEvent);

        let notif = Array.isArray(gameEnv.notificationQueue)
            ? gameEnv.notificationQueue.find((e) => e && e.id === choiceEvent.id && e.type === 'TARGET_CHOICE')
            : undefined;
        expect(notif).toBeTruthy();
        expect(notif.payload.choiceKind).toBe('GRANT_KEYWORD');
        expect(notif.payload.choice.contextKind).toBeUndefined();

        choiceEvent.data.context = { kind: 'SEQUENCE_CONTINUATION_AFTER_CHOICE' };
        ChoiceNotificationEmitter.syncTargetChoiceNotification(gameEnv, choiceEvent);

        notif = Array.isArray(gameEnv.notificationQueue)
            ? gameEnv.notificationQueue.find((e) => e && e.id === choiceEvent.id && e.type === 'TARGET_CHOICE')
            : undefined;
        expect(notif).toBeTruthy();
        expect(notif.payload.choiceKind).toBe('SEQUENCE_GRANT_KEYWORD');
        expect(notif.payload.choice.contextKind).toBe('SEQUENCE_CONTINUATION_AFTER_CHOICE');
    });
});
