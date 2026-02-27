const { GameEnvironment } = require('../models/GameEnvironment');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { ChoiceNotificationEmitter } = require('../services/notifications/ChoiceNotificationEmitter');

describe('BLOCKER_CHOICE notification persistence', () => {
    test('emitBlockerChoiceCreated creates persistent acknowledgment notification', () => {
        const gameEnv = new GameEnvironment();
        const attackEvent = EventFactory.createPlayerActionEvent('player_attacker', 'attackUnit', {
            attackerCarduid: 'attacker_uid_1',
            targetUnitUid: 'target_uid_1',
            targetPlayerId: 'player_defender'
        });
        const blockerChoiceEvent = EventFactory.createBlockerChoiceEvent({
            blockingPlayerId: 'player_defender',
            originalAttackEvent: attackEvent,
            availableTargets: [
                {
                    carduid: 'blocker_uid_1',
                    zone: 'slot1',
                    playerId: 'player_defender'
                }
            ]
        });

        ChoiceNotificationEmitter.emitBlockerChoiceCreated(gameEnv, blockerChoiceEvent);

        const notification = (gameEnv.notificationQueue || []).find(
            (event) => event && event.id === blockerChoiceEvent.id && event.type === 'BLOCKER_CHOICE'
        );

        expect(notification).toBeTruthy();
        expect(notification.metadata.requiresAcknowledgment).toBe(true);
        expect(notification.metadata.expiresAt).toBe(Number.MAX_SAFE_INTEGER);
        expect(notification.payload.isCompleted).toBe(false);
        expect(notification.payload.playerId).toBe('player_defender');
    });
});
