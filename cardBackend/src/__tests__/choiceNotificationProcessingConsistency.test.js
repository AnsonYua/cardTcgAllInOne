const { GameLogic } = require('../services/GameLogic');
const { GameEnvironment } = require('../models/GameEnvironment');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { ChoiceNotificationEmitter } = require('../services/notifications/ChoiceNotificationEmitter');

function createTargetChoiceEvent() {
    return EventFactory.createTargetChoiceEvent({
        playerId: 'playerId_2',
        sourceCarduid: 'source_target_choice_1',
        effect: {
            effectId: 'target_effect',
            type: 'triggered',
            trigger: 'DESTROYED',
            action: 'discardFromHand',
            target: {
                type: 'card',
                scope: 'self_hand',
                count: 1,
                selection: { type: 'player_choice' }
            }
        },
        availableTargets: [
            {
                carduid: 'GD01-088_pilot_0001',
                zone: 'hand',
                playerId: 'playerId_2'
            }
        ]
    });
}

function createBlockerChoiceEvent() {
    const originalAttackEvent = EventFactory.createPlayerActionEvent('playerId_1', 'attackUnit', {
        attackerCarduid: 'attacker_uid_1',
        targetUnitUid: 'target_uid_1',
        targetPlayerId: 'playerId_2'
    });
    return EventFactory.createBlockerChoiceEvent({
        blockingPlayerId: 'playerId_2',
        originalAttackEvent,
        availableTargets: [
            {
                carduid: 'blocker_uid_1',
                zone: 'slot1',
                playerId: 'playerId_2'
            }
        ]
    });
}

function createBurstChoiceEvent() {
    return EventFactory.createBurstEffectChoiceEvent('playerId_2', [
        {
            carduid: 'shield_card_1',
            cardId: 'GD01-125',
            cardData: {
                id: 'GD01-125',
                name: 'Burst Sample',
                effects: {
                    rules: [
                        {
                            effectId: 'burst_add',
                            trigger: 'BURST_CONDITION',
                            action: 'addToHand',
                            target: { type: 'card', scope: 'self', count: 1 }
                        }
                    ]
                }
            }
        }
    ]);
}

describe('Choice notification/processing consistency after persistence', () => {
    test('every active unresolved choice notification maps to a processingQueue event id after save/load', async () => {
        const logic = new GameLogic();
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const targetChoice = createTargetChoiceEvent();
        const blockerChoice = createBlockerChoiceEvent();
        const burstChoice = createBurstChoiceEvent();

        gameEnv.enqueueForProcessing(targetChoice);
        gameEnv.enqueueForProcessing(blockerChoice);
        gameEnv.enqueueForProcessing(burstChoice);

        ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, targetChoice);
        ChoiceNotificationEmitter.emitBlockerChoiceCreated(gameEnv, blockerChoice);
        ChoiceNotificationEmitter.emitBurstChoiceCreated(gameEnv, burstChoice);

        const gameId = `test_choice_consistency_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
        await logic.saveGameToFile(gameId, gameEnv);
        const reloaded = await logic.loadGameFromFile(gameId);

        expect(reloaded).toBeTruthy();
        const notifications = Array.isArray(reloaded.notificationQueue) ? reloaded.notificationQueue : [];
        const processingIds = new Set((reloaded.processingQueue || []).map((event) => event.id));

        const activeChoiceNotifications = notifications.filter((note) => {
            const type = String(note?.type || '').toUpperCase();
            const isChoice = type === 'TARGET_CHOICE' || type === 'BLOCKER_CHOICE' || type === 'BURST_EFFECT_CHOICE';
            return isChoice && note?.payload?.isCompleted !== true;
        });

        expect(activeChoiceNotifications.length).toBeGreaterThan(0);
        for (const note of activeChoiceNotifications) {
            expect(processingIds.has(note.id)).toBe(true);
        }
    });
});
