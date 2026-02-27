const fs = require('fs');
const path = require('path');
const { GameEnvironment } = require('../models/GameEnvironment');
const { GameLogic } = require('../services/GameLogic');
const { EventType } = require('../models/GameEnums');
const { EventStatus, EventPriority } = require('../services/EventQueue/interfaces/GameEvent');

describe('choice persistence serialization', () => {
    const writtenGameIds = new Set();

    afterEach(() => {
        for (const gameId of writtenGameIds) {
            const filePath = path.join(process.cwd(), 'src/gameData', `${gameId}.json`);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch {
                // Ignore cleanup failures in tests.
            }
        }
        writtenGameIds.clear();
    });

    function createDeclaredTargetChoice(id = 'target_choice_test_1') {
        return {
            id,
            type: EventType.TARGET_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId: 'playerId_2',
            timestamp: Date.now(),
            data: {
                choiceId: `choice_${id}`,
                userDecisionMade: false,
                availableTargets: [
                    { carduid: 'GD01-088_pilot_0001', zone: 'hand', playerId: 'playerId_2' }
                ],
                effect: {
                    effectId: 'sequence_discard',
                    trigger: 'SEQUENCE_STEP',
                    optional: false,
                    action: 'discardFromHand',
                    target: { type: 'card', scope: 'self_hand', count: 1 }
                }
            }
        };
    }

    function createBattleResolvedNotification() {
        return {
            id: 'battle_resolved_test_1',
            type: 'BATTLE_RESOLVED',
            metadata: {
                timestamp: Date.now(),
                expiresAt: Date.now() + 3000,
                requiresAcknowledgment: false,
                priority: 'normal'
            },
            payload: {}
        };
    }

    test('toPersistenceJSON keeps declared TARGET_CHOICE while toJSON hides it during unconsumed BATTLE_RESOLVED', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.processingQueue = [createDeclaredTargetChoice()];
        gameEnv.notificationQueue = [createBattleResolvedNotification()];

        const client = gameEnv.toJSON();
        const persisted = gameEnv.toPersistenceJSON();

        expect((client.processingQueue || []).map((event) => event.type)).toEqual([]);
        expect((persisted.processingQueue || []).map((event) => event.type)).toEqual([EventType.TARGET_CHOICE]);
    });

    test('save/load preserves declared TARGET_CHOICE and confirmTargetChoice succeeds after reload', async () => {
        const logic = new GameLogic();
        const gameId = `test_choice_persistence_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        writtenGameIds.add(gameId);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.playerId_1 = 'playerId_1';
        gameEnv.playerId_2 = 'playerId_2';
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'MAIN_PHASE';
        gameEnv.gameStarted = true;
        gameEnv.processingQueue = [createDeclaredTargetChoice('target_choice_test_2')];
        gameEnv.notificationQueue = [createBattleResolvedNotification()];
        gameEnv.players.playerId_2.deck._handUids = ['GD01-088_pilot_0001'];

        await logic.saveGameToFile(gameId, gameEnv);
        const reloaded = await logic.loadGameFromFile(gameId);
        expect(reloaded).toBeTruthy();
        expect(reloaded.processingQueue.some((event) => event.id === 'target_choice_test_2')).toBe(true);

        const result = await logic.confirmTargetChoice(
            gameId,
            'playerId_2',
            'target_choice_test_2',
            [{ carduid: 'GD01-088_pilot_0001', zone: 'hand', playerId: 'playerId_2' }]
        );

        expect(result.success).toBe(true);
        const remaining = (result.gameEnv?.processingQueue || []).find((event) => event.id === 'target_choice_test_2');
        expect(remaining).toBeFalsy();
    });
});
