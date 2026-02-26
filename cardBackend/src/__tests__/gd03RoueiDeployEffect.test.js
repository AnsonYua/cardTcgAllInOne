const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

function getDeployEffect() {
    return gd03.cards['GD03-067'].effects.rules.find(
        (rule) => rule.effectId === 'deploy_effect' && rule.trigger === 'ENTERS_PLAY'
    );
}

function findTargetChoice(gameEnv) {
    return gameEnv.processingQueue.find((event) => event?.type === 'TARGET_CHOICE');
}

function findContinuation(gameEnv) {
    return gameEnv.processingQueue.find(
        (event) => event?.type === 'PLAYER_ACTION' && event?.data?.actionType === 'continueSequence'
    );
}

function setupGame() {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = p1.id;
    gameEnv.phase = 'MAIN_PHASE';

    p1.zones.slot1.unit = createUnitZoneCard({
        carduid: 'friendly_target_a_0001',
        cardId: 'ALLY-A-0001',
        ap: 2,
        hp: 3,
        cardDataExtras: { level: 2, color: 'Purple', traits: ['Teiwaz'] }
    });
    p1.zones.slot2.unit = createUnitZoneCard({
        carduid: 'friendly_target_b_0001',
        cardId: 'ALLY-B-0001',
        ap: 4,
        hp: 4,
        cardDataExtras: { level: 4, color: 'Purple', traits: ['Tekkadan'] }
    });
    p1.zones.slot3.unit = createUnitZoneCard({
        carduid: 'GD03-067_source_0001',
        cardId: 'GD03-067',
        name: gd03.cards['GD03-067'].name,
        ap: gd03.cards['GD03-067'].ap,
        hp: gd03.cards['GD03-067'].hp,
        traits: gd03.cards['GD03-067'].traits,
        link: gd03.cards['GD03-067'].link,
        cardDataExtras: { effects: gd03.cards['GD03-067'].effects }
    });

    return { gameEnv, p1 };
}

describe('GD03-067 (Rouei) deploy effect sequence targeting', () => {
    test('damages and buffs the same selected unit (no second target choice)', () => {
        const deployEffect = getDeployEffect();
        expect(deployEffect).toBeTruthy();

        const { gameEnv, p1 } = setupGame();

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, 'GD03-067_source_0001', deployEffect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choiceEvent = findTargetChoice(gameEnv);
        expect(choiceEvent).toBeTruthy();
        const targetA = choiceEvent.data.availableTargets.find((t) => t.carduid === 'friendly_target_a_0001');
        expect(targetA).toBeTruthy();

        const chooseResult = SequenceTargetChoiceHandler.tryHandle(gameEnv, choiceEvent, [targetA]);
        expect(chooseResult.handled).toBe(true);
        expect(chooseResult.success).toBe(true);

        const continuation = findContinuation(gameEnv);
        expect(continuation).toBeTruthy();
        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continuation);
        expect(continueResult.success).toBe(true);

        expect(p1.zones.slot1.unit.damageReceived || 0).toBe(1);
        expect(p1.zones.slot1.unit.modifyAP || 0).toBe(1);
        expect(p1.zones.slot2.unit.damageReceived || 0).toBe(0);
        expect(p1.zones.slot2.unit.modifyAP || 0).toBe(0);

        const targetATemporaryEffects = Array.isArray(p1.zones.slot1.unit.temporaryEffects) ? p1.zones.slot1.unit.temporaryEffects : [];
        expect(targetATemporaryEffects).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    duration: 'UNTIL_END_OF_TURN',
                    modifyAP: 1,
                    sourceCarduid: 'GD03-067_source_0001'
                })
            ])
        );

        const modifyApChoiceEvents = (gameEnv.processingQueue || []).filter(
            (event) => event?.type === 'TARGET_CHOICE' && event?.data?.effect?.action === 'modifyAP'
        );
        expect(modifyApChoiceEvents).toHaveLength(0);
    });

    test('declining optional target choice causes no damage and no AP buff', () => {
        const deployEffect = getDeployEffect();
        expect(deployEffect).toBeTruthy();

        const { gameEnv, p1 } = setupGame();

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, 'GD03-067_source_0001', deployEffect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choiceEvent = findTargetChoice(gameEnv);
        expect(choiceEvent).toBeTruthy();

        const declineResult = SequenceTargetChoiceHandler.tryHandle(gameEnv, choiceEvent, []);
        expect(declineResult.handled).toBe(true);
        expect(declineResult.success).toBe(true);

        const continuation = findContinuation(gameEnv);
        expect(continuation).toBeTruthy();
        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continuation);
        expect(continueResult.success).toBe(true);

        expect(p1.zones.slot1.unit.damageReceived || 0).toBe(0);
        expect(p1.zones.slot1.unit.modifyAP || 0).toBe(0);
        expect(p1.zones.slot2.unit.damageReceived || 0).toBe(0);
        expect(p1.zones.slot2.unit.modifyAP || 0).toBe(0);

        const damageNotifications = (gameEnv.notificationQueue || []).filter((event) => event?.type === 'CARD_DAMAGED');
        expect(damageNotifications).toHaveLength(0);
    });
});
