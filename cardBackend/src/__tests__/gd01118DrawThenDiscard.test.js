const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType, PlayerActionType } = require('../models/GameEnums');
const { processAction } = require('../services/actions/ActionProcessor');
const { ChoiceConfirmationService } = require('../services/choices/ChoiceConfirmationService');
const { EnergyManager } = require('../services/EnergyManager');

describe('GD01-118 Overflowing Affection', () => {
    test('play command draws 2 then requires discarding 1 from hand', async () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'MAIN_PHASE';

        const player = gameEnv.getPlayer('playerId_1');
        expect(player).toBeTruthy();

        const gd01118Uid = 'GD01-118_cmd_test_0001';
        player.deck._handUids = [gd01118Uid];
        player.deck.mainDeck = [
            'ST01-009_draw_test_0001',
            'GD01-072_draw_test_0002',
            'ST03-001_draw_test_0003'
        ];

        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);

        const playResult = await processAction(gameEnv, {
            type: PlayerActionType.PLAY_CARD,
            playerId: 'playerId_1',
            gameId: 'game_gd01118_test',
            carduid: gd01118Uid,
            playAs: 'command'
        });

        expect(playResult.success).toBe(true);

        const targetChoiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(targetChoiceEvent).toBeTruthy();
        expect(targetChoiceEvent.data.userDecisionMade).toBe(false);
        expect(targetChoiceEvent.data.effect.action).toBe('discardFromHand');

        const targetChoiceNotification = gameEnv.notificationQueue.find(
            (event) => event && event.id === targetChoiceEvent.id && event.type === 'TARGET_CHOICE'
        );
        expect(targetChoiceNotification).toBeTruthy();
        expect(targetChoiceNotification.payload.choiceKind).toBe('DISCARD_FROM_HAND');

        // Command leaves hand when played; draw 2 should leave exactly 2 cards before discard confirmation.
        expect(player.deck.handUids).toHaveLength(2);

        const selectedTarget = targetChoiceEvent.data.availableTargets[0];
        expect(selectedTarget).toBeTruthy();

        const persistence = {
            loadGameFromFile: async () => gameEnv,
            saveGameToFile: async () => {}
        };

        const confirmResult = await ChoiceConfirmationService.confirmTargetChoice(
            persistence,
            'game_gd01118_test',
            'playerId_1',
            targetChoiceEvent.id,
            [
                {
                    carduid: selectedTarget.carduid,
                    zone: selectedTarget.zone,
                    playerId: selectedTarget.playerId
                }
            ]
        );

        expect(confirmResult.success).toBe(true);
        expect(player.deck.handUids).toHaveLength(1);

        const discardedInTrash = player.zones.trashArea.some((card) => card.carduid === selectedTarget.carduid);
        expect(discardedInTrash).toBe(true);

        const discardNotification = gameEnv.notificationQueue.find(
            (event) =>
                event &&
                event.type === 'CARD_DISCARDED_FROM_HAND' &&
                event.payload &&
                event.payload.carduid === selectedTarget.carduid
        );
        expect(discardNotification).toBeTruthy();
    });
});
