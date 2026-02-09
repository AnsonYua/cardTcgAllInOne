const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { ChoiceNotificationEmitter } = require('../services/notifications/ChoiceNotificationEmitter');
const { ChoiceConfirmationService } = require('../services/choices/ChoiceConfirmationService');

describe('Optional COST target choice count semantics', () => {
    test('emitTargetChoiceCreated keeps exact count for optional COST choices', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const event = {
            id: 'choice_cost_1',
            type: EventType.TARGET_CHOICE,
            status: 'DECLARED',
            priority: 0,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                choiceId: 'c1',
                userDecisionMade: false,
                sourceCarduid: 'SRC',
                effect: {
                    effectId: 'some_cost',
                    type: 'internal',
                    trigger: 'COST',
                    optional: true,
                    action: 'exileFromTrash',
                    target: { type: 'card', scope: 'self_trash', count: 4 }
                },
                availableTargets: []
            }
        };

        ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, event);
        const notification = gameEnv.notificationQueue.find(n => n.id === 'choice_cost_1');
        expect(notification).toBeTruthy();
        expect(notification.payload.allowEmptySelection).toBe(true);
        expect(notification.payload.targetCount).toEqual({ min: 4, max: 4 });
    });

    test('emitTargetChoiceCreated allows empty selection for non-cost optional effects', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const event = {
            id: 'choice_opt_1',
            type: EventType.TARGET_CHOICE,
            status: 'DECLARED',
            priority: 0,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                choiceId: 'c2',
                userDecisionMade: false,
                sourceCarduid: 'SRC',
                effect: {
                    effectId: 'some_optional',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    optional: true,
                    action: 'destroy',
                    target: { type: 'unit', scope: 'opponent', count: 1 }
                },
                availableTargets: []
            }
        };

        ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, event);
        const notification = gameEnv.notificationQueue.find(n => n.id === 'choice_opt_1');
        expect(notification).toBeTruthy();
        expect(notification.payload.allowEmptySelection).toBe(true);
        expect(notification.payload.targetCount).toEqual({ min: 0, max: 1 });
    });

    test('confirmTargetChoice rejects partial selection for optional COST choices', async () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const availableTargets = [
            { carduid: 't1', zone: 'trash', playerId: 'playerId_1' },
            { carduid: 't2', zone: 'trash', playerId: 'playerId_1' },
            { carduid: 't3', zone: 'trash', playerId: 'playerId_1' },
            { carduid: 't4', zone: 'trash', playerId: 'playerId_1' }
        ];

        const event = {
            id: 'choice_cost_2',
            type: EventType.TARGET_CHOICE,
            status: 'DECLARED',
            priority: 0,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                choiceId: 'c3',
                userDecisionMade: false,
                sourceCarduid: 'SRC',
                effect: {
                    effectId: 'some_cost',
                    type: 'internal',
                    trigger: 'COST',
                    optional: true,
                    action: 'exileFromTrash',
                    target: { type: 'card', scope: 'self_trash', count: 4 }
                },
                availableTargets
            }
        };

        gameEnv.processingQueue.push(event);

        const persistence = {
            loadGameFromFile: async () => gameEnv,
            saveGameToFile: async () => {}
        };

        const result = await ChoiceConfirmationService.confirmTargetChoice(
            persistence,
            'game1',
            'playerId_1',
            'choice_cost_2',
            [availableTargets[0]]
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/exactly 4/);
    });
});
