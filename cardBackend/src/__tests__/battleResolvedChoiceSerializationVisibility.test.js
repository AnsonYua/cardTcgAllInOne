const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { EventStatus, EventPriority } = require('../services/EventQueue/interfaces/GameEvent');

describe('battle-resolved choice serialization visibility', () => {
    function createChoiceEvent(id, type = EventType.TARGET_CHOICE) {
        return {
            id,
            type,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                choiceId: `choice_${id}`,
                userDecisionMade: false
            }
        };
    }

    test('hides declared blocking choices from serialized processingQueue while BATTLE_RESOLVED exists', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.processingQueue = [
            createChoiceEvent('target_choice_1', EventType.TARGET_CHOICE),
            createChoiceEvent('blocker_choice_1', EventType.BLOCKER_CHOICE),
            createChoiceEvent('burst_choice_1', EventType.BURST_EFFECT_CHOICE),
            {
                id: 'normal_event_1',
                type: EventType.PLAYER_ACTION,
                status: EventStatus.DECLARED,
                priority: EventPriority.NORMAL,
                playerId: 'playerId_1',
                timestamp: Date.now(),
                data: {}
            }
        ];
        gameEnv.notificationQueue = [
            {
                id: 'battle_resolved_1',
                type: 'BATTLE_RESOLVED',
                metadata: { timestamp: Date.now(), expiresAt: Date.now() + 3000, requiresAcknowledgment: false, priority: 'normal' },
                payload: {}
            }
        ];

        const serialized = gameEnv.toJSON();
        const serializedTypes = (serialized.processingQueue || []).map((event) => event.type);

        expect(serializedTypes).toEqual([EventType.PLAYER_ACTION]);
    });

    test('keeps declared blocking choices visible when there is no BATTLE_RESOLVED notification', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.processingQueue = [createChoiceEvent('target_choice_1', EventType.TARGET_CHOICE)];
        gameEnv.notificationQueue = [];

        const serialized = gameEnv.toJSON();
        const serializedTypes = (serialized.processingQueue || []).map((event) => event.type);

        expect(serializedTypes).toEqual([EventType.TARGET_CHOICE]);
    });

    test('keeps non-declared blocking choices visible even when BATTLE_RESOLVED exists', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.processingQueue = [
            {
                ...createChoiceEvent('target_choice_1', EventType.TARGET_CHOICE),
                status: EventStatus.RESOLVING
            }
        ];
        gameEnv.notificationQueue = [
            {
                id: 'battle_resolved_1',
                type: 'BATTLE_RESOLVED',
                metadata: { timestamp: Date.now(), expiresAt: Date.now() + 3000, requiresAcknowledgment: false, priority: 'normal' },
                payload: {}
            }
        ];

        const serialized = gameEnv.toJSON();
        const serializedTypes = (serialized.processingQueue || []).map((event) => event.type);

        expect(serializedTypes).toEqual([EventType.TARGET_CHOICE]);
    });
});
