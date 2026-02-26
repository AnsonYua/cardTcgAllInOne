const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');

function findSlotByUnitUid(gameEnv, playerId, unitUid) {
    const player = gameEnv.getPlayer(playerId);
    for (let i = 1; i <= 6; i++) {
        const slotName = `slot${i}`;
        const slot = player?.zones?.[slotName];
        if (slot?.unit?.carduid === unitUid) {
            return { slotName, slot };
        }
    }
    return null;
}

function latestDeclaredTargetChoice(gameEnv, sourceCarduid) {
    const queue = Array.isArray(gameEnv.processingQueue) ? gameEnv.processingQueue : [];
    for (let i = queue.length - 1; i >= 0; i--) {
        const event = queue[i];
        if (!event || event.type !== 'TARGET_CHOICE' || event.status !== 'DECLARED') continue;
        if (sourceCarduid && event?.data?.sourceCarduid !== sourceCarduid) continue;
        return event;
    }
    return null;
}

function latestContinueSequenceEvent(gameEnv, sourceCarduid) {
    const queue = Array.isArray(gameEnv.processingQueue) ? gameEnv.processingQueue : [];
    for (let i = queue.length - 1; i >= 0; i--) {
        const event = queue[i];
        if (!event || event.type !== 'PLAYER_ACTION' || event.status !== 'DECLARED') continue;
        if (event?.data?.actionType !== 'continueSequence') continue;
        if (sourceCarduid && event?.data?.sourceCarduid !== sourceCarduid) continue;
        return event;
    }
    return null;
}

describe('sequence effect ordering for EFFECT_DAMAGE_RECEIVED triggers', () => {
    test('GD03-056 finishes both sequence target choices before GD03-095 target choice appears', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.gameStarted = true;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'MAIN_PHASE';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD03-050_unit_0001',
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD03-095_pilot_0001',
            playAs: 'pilot',
            targetUnit: 'GD03-050_unit_0001'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD03-056_hand_0001',
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: 'GD03-068_enemy_0001',
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: 'GD03-070_enemy_0001',
            playAs: 'unit'
        }).success).toBe(true);

        const sourceLookup = findSlotByUnitUid(gameEnv, 'playerId_1', 'GD03-056_hand_0001');
        expect(sourceLookup).toBeTruthy();
        const deployEffect = sourceLookup.slot.unit.cardData.effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        expect(deployEffect).toBeTruthy();

        const startResult = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD03-056_hand_0001',
            deployEffect
        );
        expect(startResult.success).toBe(true);
        expect(startResult.requiresSelection).toBe(true);

        // Resolve sequence step 1: self damage target choice.
        const selfChoice = latestDeclaredTargetChoice(gameEnv, 'GD03-056_hand_0001');
        expect(selfChoice).toBeTruthy();
        const handleSelfChoice = SequenceTargetChoiceHandler.tryHandle(
            gameEnv,
            selfChoice,
            [{ carduid: 'GD03-050_unit_0001', zone: 'slot1', playerId: 'playerId_1' }]
        );
        expect(handleSelfChoice.handled).toBe(true);
        expect(handleSelfChoice.success).toBe(true);

        const continueAfterSelf = latestContinueSequenceEvent(gameEnv, 'GD03-056_hand_0001');
        expect(continueAfterSelf).toBeTruthy();
        const continueSelfResult = SequenceContinuationManager.continueSequence(gameEnv, continueAfterSelf);
        expect(continueSelfResult.success).toBe(true);
        expect(continueSelfResult.requiresSelection).toBe(true);

        // GD03-095 choice must not appear yet (should be deferred until sequence completion).
        const queueAfterSelf = Array.isArray(gameEnv.processingQueue) ? gameEnv.processingQueue : [];
        const gd03095ChoicesAfterSelf = queueAfterSelf.filter((e) =>
            e?.type === 'TARGET_CHOICE' &&
            e?.status === 'DECLARED' &&
            e?.data?.sourceCarduid === 'GD03-095_pilot_0001'
        );
        expect(gd03095ChoicesAfterSelf.length).toBe(0);

        // Resolve sequence step 2: opponent damage target choice.
        const opponentChoice = latestDeclaredTargetChoice(gameEnv, 'GD03-056_hand_0001');
        expect(opponentChoice).toBeTruthy();
        const handleOpponentChoice = SequenceTargetChoiceHandler.tryHandle(
            gameEnv,
            opponentChoice,
            [{ carduid: 'GD03-068_enemy_0001', zone: 'slot1', playerId: 'playerId_2' }]
        );
        expect(handleOpponentChoice.handled).toBe(true);
        expect(handleOpponentChoice.success).toBe(true);

        const continueAfterOpponent = latestContinueSequenceEvent(gameEnv, 'GD03-056_hand_0001');
        expect(continueAfterOpponent).toBeTruthy();
        const continueOpponentResult = SequenceContinuationManager.continueSequence(gameEnv, continueAfterOpponent);
        expect(continueOpponentResult.success).toBe(true);
        expect(continueOpponentResult.requiresSelection).toBe(true);

        const queueAfterComplete = Array.isArray(gameEnv.processingQueue) ? gameEnv.processingQueue : [];
        const gd03095Choices = queueAfterComplete.filter((e) =>
            e?.type === 'TARGET_CHOICE' &&
            e?.status === 'DECLARED' &&
            e?.data?.sourceCarduid === 'GD03-095_pilot_0001'
        );
        expect(gd03095Choices.length).toBe(1);
    });

    test('GD03-095 deferred trigger survives GameEnvironment serialization between sequence choices', () => {
        let gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.gameStarted = true;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'MAIN_PHASE';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD03-050_unit_0001',
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD03-095_pilot_0001',
            playAs: 'pilot',
            targetUnit: 'GD03-050_unit_0001'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD03-056_hand_0001',
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: 'GD03-068_enemy_0001',
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: 'GD03-070_enemy_0001',
            playAs: 'unit'
        }).success).toBe(true);

        const sourceLookup = findSlotByUnitUid(gameEnv, 'playerId_1', 'GD03-056_hand_0001');
        expect(sourceLookup).toBeTruthy();
        const deployEffect = sourceLookup.slot.unit.cardData.effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        expect(deployEffect).toBeTruthy();

        const startResult = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD03-056_hand_0001',
            deployEffect
        );
        expect(startResult.success).toBe(true);
        expect(startResult.requiresSelection).toBe(true);

        const selfChoice = latestDeclaredTargetChoice(gameEnv, 'GD03-056_hand_0001');
        expect(selfChoice).toBeTruthy();
        const handleSelfChoice = SequenceTargetChoiceHandler.tryHandle(
            gameEnv,
            selfChoice,
            [{ carduid: 'GD03-050_unit_0001', zone: 'slot1', playerId: 'playerId_1' }]
        );
        expect(handleSelfChoice.handled).toBe(true);
        expect(handleSelfChoice.success).toBe(true);

        const continueAfterSelf = latestContinueSequenceEvent(gameEnv, 'GD03-056_hand_0001');
        expect(continueAfterSelf).toBeTruthy();
        const continueSelfResult = SequenceContinuationManager.continueSequence(gameEnv, continueAfterSelf);
        expect(continueSelfResult.success).toBe(true);
        expect(continueSelfResult.requiresSelection).toBe(true);

        const queueAfterSelf = Array.isArray(gameEnv.processingQueue) ? gameEnv.processingQueue : [];
        const gd03095ChoicesAfterSelf = queueAfterSelf.filter((e) =>
            e?.type === 'TARGET_CHOICE' &&
            e?.status === 'DECLARED' &&
            e?.data?.sourceCarduid === 'GD03-095_pilot_0001'
        );
        expect(gd03095ChoicesAfterSelf.length).toBe(0);

        // Reproduce API persistence boundary: save + load between choice confirmations.
        const serialized = gameEnv.toJSON();
        expect(Array.isArray(serialized.deferredEffectDamageReceivedEntries)).toBe(true);
        expect(serialized.deferredEffectDamageReceivedEntries.length).toBeGreaterThan(0);
        expect(serialized.deferredEffectDamageReceivedEntries[0]?.notificationOverride?.type).toBe('CARD_DAMAGED');
        expect(serialized.deferredEffectDamageReceivedEntries[0]?.notificationOverride?.payload?.carduid).toBe('GD03-050_unit_0001');
        gameEnv = GameEnvironment.fromJSON(serialized);

        const opponentChoice = latestDeclaredTargetChoice(gameEnv, 'GD03-056_hand_0001');
        expect(opponentChoice).toBeTruthy();
        const handleOpponentChoice = SequenceTargetChoiceHandler.tryHandle(
            gameEnv,
            opponentChoice,
            [{ carduid: 'GD03-068_enemy_0001', zone: 'slot1', playerId: 'playerId_2' }]
        );
        expect(handleOpponentChoice.handled).toBe(true);
        expect(handleOpponentChoice.success).toBe(true);

        const continueAfterOpponent = latestContinueSequenceEvent(gameEnv, 'GD03-056_hand_0001');
        expect(continueAfterOpponent).toBeTruthy();
        const continueOpponentResult = SequenceContinuationManager.continueSequence(gameEnv, continueAfterOpponent);
        expect(continueOpponentResult.success).toBe(true);
        expect(continueOpponentResult.requiresSelection).toBe(true);

        const queueAfterComplete = Array.isArray(gameEnv.processingQueue) ? gameEnv.processingQueue : [];
        const gd03095Choices = queueAfterComplete.filter((e) =>
            e?.type === 'TARGET_CHOICE' &&
            e?.status === 'DECLARED' &&
            e?.data?.sourceCarduid === 'GD03-095_pilot_0001'
        );
        expect(gd03095Choices.length).toBe(1);
    });
});
