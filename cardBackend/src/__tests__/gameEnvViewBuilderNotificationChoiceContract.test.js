const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { EventStatus, EventPriority } = require('../services/EventQueue/interfaces/GameEvent');
const { GameEnvViewBuilder } = require('../services/views/GameEnvViewBuilder');

describe('GameEnvViewBuilder notification-first choice contract', () => {
    function createTargetChoiceEvent(id = 'target_choice_1') {
        return {
            id,
            type: EventType.TARGET_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId: 'playerId_2',
            timestamp: Date.now(),
            data: {
                choiceId: `choice_${id}`,
                userDecisionMade: false
            }
        };
    }

    test('exposes choice in notificationQueue while processingQueue is sanitized', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.processingQueue = [createTargetChoiceEvent()];
        gameEnv.notificationQueue = [
            {
                id: 'target_choice_1',
                type: 'TARGET_CHOICE',
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Number.MAX_SAFE_INTEGER,
                    requiresAcknowledgment: true,
                    priority: 'high'
                },
                payload: {
                    playerId: 'playerId_2',
                    isCompleted: false,
                    event: createTargetChoiceEvent()
                }
            }
        ];

        const view = GameEnvViewBuilder.toPlayerView(gameEnv, 'playerId_2');
        expect(Array.isArray(view.processingQueue)).toBe(true);
        expect(view.processingQueue).toHaveLength(0);

        const notes = Array.isArray(view.notificationQueue) ? view.notificationQueue : [];
        const targetChoice = notes.find((entry) => entry && entry.type === 'TARGET_CHOICE');
        expect(targetChoice).toBeTruthy();
        expect(targetChoice.payload?.event?.id).toBe('target_choice_1');
        expect(targetChoice.payload?.event?.data?.userDecisionMade).toBe(false);
    });
});
