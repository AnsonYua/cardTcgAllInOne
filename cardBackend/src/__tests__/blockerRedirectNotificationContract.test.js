const { GameLogic } = require('../services/GameLogic');

function createGameEnvFixture() {
    const defenderId = 'player_defender';
    const attackerId = 'player_attacker';
    const attackNotificationId = 'attack_note_1';
    const blockerEventId = 'blocker_choice_1';

    const gameEnv = {
        notificationQueue: [
            {
                id: attackNotificationId,
                type: 'UNIT_ATTACK_DECLARED',
                payload: {
                    attackingPlayerId: attackerId,
                    defendingPlayerId: defenderId,
                    attackerCarduid: 'attacker_uid_1',
                    attackerSlot: 'slot2',
                    targetName: 'Shield Area',
                    targetSlotName: 'shieldArea'
                },
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 3000,
                    requiresAcknowledgment: false,
                    priority: 'normal'
                }
            },
            {
                id: blockerEventId,
                type: 'BLOCKER_CHOICE',
                payload: {
                    event: {
                        id: blockerEventId,
                        type: 'BLOCKER_CHOICE',
                        data: {}
                    }
                },
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 3000,
                    requiresAcknowledgment: false,
                    priority: 'high'
                }
            }
        ],
        processingQueue: [
            {
                id: blockerEventId,
                type: 'BLOCKER_CHOICE',
                playerId: defenderId,
                data: {
                    blockingPlayerId: defenderId,
                    availableTargets: [
                        {
                            carduid: 'blocker_uid_1',
                            zone: 'slot1',
                            playerId: defenderId
                        }
                    ],
                    originalAttackEvent: {
                        data: {
                            attackNotificationId
                        }
                    }
                }
            }
        ],
        players: {
            [defenderId]: {
                id: defenderId,
                zones: {
                    slot1: {
                        unit: {
                            carduid: 'blocker_uid_1',
                            cardId: 'GD01-086',
                            cardData: {
                                id: 'GD01-086',
                                name: 'Gundam Lfrith'
                            }
                        }
                    }
                }
            }
        },
        currentBattle: undefined,
        dequeueFromProcessing(event) {
            const idx = this.processingQueue.findIndex((entry) => entry.id === event.id);
            if (idx < 0) return false;
            this.processingQueue.splice(idx, 1);
            return true;
        },
        needsPlayerInput() {
            return false;
        },
        async processEvents() {
            this.processingQueue = [];
            this.currentBattle = undefined;
            return { success: true };
        },
        haveBothPlayersConfirmedBattle() {
            return false;
        },
        getPlayer(playerId) {
            return this.players[playerId] || null;
        }
    };

    return {
        gameEnv,
        defenderId,
        attackNotificationId,
        blockerEventId
    };
}

describe('confirmBlockerChoice notification contract', () => {
    test('BLOCK updates UNIT_ATTACK_DECLARED forced target and emits REFRESH_TARGET', async () => {
        const logic = new GameLogic();
        const fixture = createGameEnvFixture();
        jest.spyOn(logic, 'loadGameFromFile').mockResolvedValue(fixture.gameEnv);
        jest.spyOn(logic, 'saveGameToFile').mockResolvedValue();

        const result = await logic.confirmBlockerChoice(
            'game_1',
            fixture.defenderId,
            fixture.blockerEventId,
            [
                {
                    carduid: 'blocker_uid_1',
                    zone: 'slot1',
                    playerId: fixture.defenderId
                }
            ],
            fixture.attackNotificationId
        );

        expect(result.success).toBe(true);

        const attackNotification = fixture.gameEnv.notificationQueue.find((note) => note.id === fixture.attackNotificationId);
        expect(attackNotification).toBeTruthy();
        expect(attackNotification.payload.forcedTargetCarduid).toBe('blocker_uid_1');
        expect(attackNotification.payload.forcedTargetZone).toBe('slot1');
        expect(attackNotification.payload.forcedTargetPlayerId).toBe(fixture.defenderId);
        expect(attackNotification.payload.targetCarduid).toBe('blocker_uid_1');
        expect(attackNotification.payload.targetSlotName).toBe('slot1');
        expect(attackNotification.payload.targetPlayerId).toBe(fixture.defenderId);

        const refreshTarget = fixture.gameEnv.notificationQueue.find((note) => note.type === 'REFRESH_TARGET');
        expect(refreshTarget).toBeTruthy();
        expect(refreshTarget.payload.sourceNotificationId).toBe(fixture.attackNotificationId);
        expect(refreshTarget.payload.forcedTargetCarduid).toBe('blocker_uid_1');
        expect(refreshTarget.payload.forcedTargetZone).toBe('slot1');
        expect(refreshTarget.payload.forcedTargetPlayerId).toBe(fixture.defenderId);

        const blockerNotification = fixture.gameEnv.notificationQueue.find((note) => note.id === fixture.blockerEventId);
        expect(blockerNotification).toBeTruthy();
        expect(blockerNotification.payload.isCompleted).toBe(true);
    });

    test('DECLINE does not mutate attack target fields or emit REFRESH_TARGET', async () => {
        const logic = new GameLogic();
        const fixture = createGameEnvFixture();
        jest.spyOn(logic, 'loadGameFromFile').mockResolvedValue(fixture.gameEnv);
        jest.spyOn(logic, 'saveGameToFile').mockResolvedValue();

        const result = await logic.confirmBlockerChoice(
            'game_1',
            fixture.defenderId,
            fixture.blockerEventId,
            [],
            fixture.attackNotificationId
        );

        expect(result.success).toBe(true);

        const attackNotification = fixture.gameEnv.notificationQueue.find((note) => note.id === fixture.attackNotificationId);
        expect(attackNotification).toBeTruthy();
        expect(attackNotification.payload.forcedTargetCarduid).toBeUndefined();
        expect(attackNotification.payload.forcedTargetZone).toBeUndefined();
        expect(attackNotification.payload.forcedTargetPlayerId).toBeUndefined();

        const refreshTarget = fixture.gameEnv.notificationQueue.find((note) => note.type === 'REFRESH_TARGET');
        expect(refreshTarget).toBeUndefined();

        const blockerNotification = fixture.gameEnv.notificationQueue.find((note) => note.id === fixture.blockerEventId);
        expect(blockerNotification).toBeTruthy();
        expect(blockerNotification.payload.isCompleted).toBe(true);
    });
});
