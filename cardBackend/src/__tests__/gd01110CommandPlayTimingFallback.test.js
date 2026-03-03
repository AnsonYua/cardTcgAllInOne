const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType, PlayerActionType } = require('../models/GameEnums');
const { processAction } = require('../services/actions/ActionProcessor');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EnergyManager } = require('../services/EnergyManager');
const { CardDatabaseManager } = require('../models/CardSystem');

describe('GD01-110 command play timing fallback', () => {
    test('play command defaults to MAIN_PHASE when timing.windows is missing and queues TARGET_CHOICE', async () => {
        const cardData = CardDatabaseManager.getCardDetails('GD01-110');
        const playRule = (cardData?.effects?.rules || []).find(
            (rule) => rule?.effectId === 'allow_attack_target_active_enemy_ap_le_6_for_unit_ge_4'
        );
        expect(playRule).toBeTruthy();
        const originalTiming = playRule?.timing ? { ...playRule.timing } : undefined;
        if (!playRule.timing || typeof playRule.timing !== 'object') {
            playRule.timing = {};
        }
        delete playRule.timing.windows;

        try {
            const gameEnv = new GameEnvironment();
            gameEnv.addPlayer('playerId_1', 'P1');
            gameEnv.addPlayer('playerId_2', 'P2');
            gameEnv.currentPlayer = 'playerId_1';
            gameEnv.currentTurn = 1;
            gameEnv.phase = 'MAIN_PHASE';

            const p1 = gameEnv.getPlayer('playerId_1');
            expect(p1).toBeTruthy();

            const commandUid = 'GD01-110_hand_main_0001';
            p1.deck._handUids = [commandUid];

            expect(
                PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                    carduid: 'GD01-001_friendly_target_0001',
                    playAs: 'unit'
                }).success
            ).toBe(true);
            expect(
                PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                    carduid: 'GD01-020_friendly_target_0002',
                    playAs: 'unit'
                }).success
            ).toBe(true);
            expect(
                PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
                    carduid: 'GD01-047_enemy_target_0003',
                    playAs: 'unit'
                }).success
            ).toBe(true);
            expect(
                PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
                    carduid: 'GD01-047_enemy_target_0004',
                    playAs: 'unit'
                }).success
            ).toBe(true);

            expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);
            expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);
            expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);

            const playResult = await processAction(gameEnv, {
                type: PlayerActionType.PLAY_CARD,
                playerId: 'playerId_1',
                gameId: 'game_gd01110_timing_fallback',
                carduid: commandUid,
                playAs: 'command'
            });

            expect(playResult.success).toBe(true);
            expect(p1.deck.handUids).not.toContain(commandUid);

            const targetChoiceEvent = gameEnv.processingQueue.find(
                (event) =>
                    event.type === EventType.TARGET_CHOICE &&
                    event?.data?.effect?.effectId === 'allow_attack_target_active_enemy_ap_le_6_for_unit_ge_4'
            );
            expect(targetChoiceEvent).toBeTruthy();
            expect(Array.isArray(targetChoiceEvent.data.availableTargets)).toBe(true);
            expect(targetChoiceEvent.data.availableTargets.length).toBe(2);
            expect(
                targetChoiceEvent.data.availableTargets.every((target) => target.playerId === 'playerId_1')
            ).toBe(true);
        } finally {
            if (originalTiming) {
                playRule.timing = originalTiming;
            } else {
                delete playRule.timing;
            }
        }
    });
});
