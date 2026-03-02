const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { OptionChoiceManager } = require('../services/effects/OptionChoiceManager');

function findQueuedAttackEffect(gameEnv) {
    return gameEnv.processingQueue.find((event) => event.type === EventType.ATTACK_PHASE_EFFECT_TRIGGERED);
}

function findTargetChoiceByEffectId(gameEnv, effectId) {
    return gameEnv.processingQueue.find(
        (event) => event.type === EventType.TARGET_CHOICE && event?.data?.effect?.effectId === effectId
    );
}

function findAttackOrderOptionChoice(gameEnv) {
    return gameEnv.processingQueue.find(
        (event) => event.type === EventType.OPTION_CHOICE && event?.data?.effect?.action === 'attack_effect_order'
    );
}

function resolveQueuedAttackEffect(gameEnv, event) {
    const result = AttackPhaseEffectManager.executeQueuedAttackPhaseEffect(gameEnv, event);
    gameEnv.dequeueFromProcessing(event);
    return result;
}

function resolveTargetChoice(gameEnv, event, selectedTargets) {
    event.status = 'RESOLVING';
    event.data.userDecisionMade = true;
    event.data.selectedTargets = selectedTargets;
    const result = DeployTargetManager.executeTargetChoice(event, gameEnv);
    gameEnv.dequeueFromProcessing(event);
    return result;
}

function resolveOptionChoice(gameEnv, event, selectedOptionIndex) {
    event.status = 'RESOLVING';
    event.data.userDecisionMade = true;
    event.data.selectedOptionIndex = selectedOptionIndex;
    const result = OptionChoiceManager.executeOptionChoice(event, gameEnv);
    gameEnv.dequeueFromProcessing(event);
    return result;
}

function setupGd02057AttackState() {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');

    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
        carduid: 'GD02-057_unit_0001',
        playAs: 'unit'
    }).success).toBe(true);
    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
        carduid: 'ST04-010_pilot_0001',
        playAs: 'pilot',
        targetUnit: 'GD02-057_unit_0001'
    }).success).toBe(true);
    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
        carduid: 'ST03-005_cost_unit_0002',
        playAs: 'unit'
    }).success).toBe(true);

    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
        carduid: 'ST03-006_enemy_0001',
        playAs: 'unit'
    }).success).toBe(true);
    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
        carduid: 'ST03-007_enemy_0002',
        playAs: 'unit'
    }).success).toBe(true);

    const attackEvent = {
        playerId: 'playerId_1',
        data: {
            playerId: 'playerId_1',
            actionType: 'attackShieldArea',
            attackerCarduid: 'GD02-057_unit_0001',
            targetPlayerId: 'playerId_2',
            targetType: 'shield',
            attackNotificationId: 'attack_note_1'
        }
    };

    return { gameEnv, attackEvent };
}

describe('GD02-057 queued attack trigger flow', () => {
    test('paying destroy cost resolves unit follow-up before paired pilot trigger and resumes battle afterward', () => {
        const { gameEnv, attackEvent } = setupGd02057AttackState();

        const queueResult = AttackPhaseEffectManager.queueAttackPhaseEffects(gameEnv, attackEvent);
        expect(queueResult.success).toBe(true);
        expect(queueResult.queued).toBe(true);

        const orderChoice = findAttackOrderOptionChoice(gameEnv);
        expect(orderChoice).toBeTruthy();
        expect(resolveOptionChoice(gameEnv, orderChoice, 0).success).toBe(true);

        const firstEffectEvent = findQueuedAttackEffect(gameEnv);
        expect(firstEffectEvent?.data?.effect?.effectId).toBe('attack_effect');

        const firstEffectResult = resolveQueuedAttackEffect(gameEnv, firstEffectEvent);
        expect(firstEffectResult.success).toBe(true);
        expect(firstEffectResult.requiresSelection).toBe(true);

        const costChoice = findTargetChoiceByEffectId(gameEnv, 'attack_effect_cost_destroyFriendlyUnit');
        expect(costChoice).toBeTruthy();
        expect(costChoice.data.context.attackEffectChainContinuation.remainingEffects).toHaveLength(1);

        const costChoiceResult = resolveTargetChoice(gameEnv, costChoice, [costChoice.data.availableTargets[0]]);
        expect(costChoiceResult.success).toBe(true);

        const unitFollowUpChoice = findTargetChoiceByEffectId(gameEnv, 'attack_effect');
        expect(unitFollowUpChoice).toBeTruthy();
        expect(unitFollowUpChoice.data.context.remainingEffects).toHaveLength(1);

        const unitFollowUpResult = resolveTargetChoice(gameEnv, unitFollowUpChoice, [unitFollowUpChoice.data.availableTargets[0]]);
        expect(unitFollowUpResult.success).toBe(true);

        expect(gameEnv.getPlayer('playerId_2').zones.slot1.unit).toBeFalsy();
        expect(
            gameEnv.getPlayer('playerId_2').zones.trashArea.some((card) => card.carduid === 'ST03-006_enemy_0001')
        ).toBe(true);

        const secondEffectEvent = findQueuedAttackEffect(gameEnv);
        expect(secondEffectEvent?.data?.effect?.effectId).toBe('attack_reduce_enemy_ap');

        const secondEffectResult = resolveQueuedAttackEffect(gameEnv, secondEffectEvent);
        expect(secondEffectResult.success).toBe(true);
        expect(secondEffectResult.requiresSelection).not.toBe(true);
        expect(findTargetChoiceByEffectId(gameEnv, 'attack_reduce_enemy_ap')).toBeFalsy();

        expect(gameEnv.getPlayer('playerId_2').zones.slot2.unit.modifyAP).toBe(-2);

        const resumeEvent = gameEnv.processingQueue.find((event) => event.type === EventType.PLAYER_ACTION);
        expect(resumeEvent).toBeTruthy();
        expect(resumeEvent.data.skipAttackPhaseEffects).toBe(true);
        expect(gameEnv.processingQueue.some((event) => event.type === EventType.ATTACK_PHASE_EFFECT_TRIGGERED)).toBe(false);
    });

    test('declining destroy cost still runs paired pilot trigger before battle resume', () => {
        const { gameEnv, attackEvent } = setupGd02057AttackState();

        expect(AttackPhaseEffectManager.queueAttackPhaseEffects(gameEnv, attackEvent).success).toBe(true);
        const orderChoice = findAttackOrderOptionChoice(gameEnv);
        expect(orderChoice).toBeTruthy();
        expect(resolveOptionChoice(gameEnv, orderChoice, 0).success).toBe(true);

        const firstEffectEvent = findQueuedAttackEffect(gameEnv);
        const firstEffectResult = resolveQueuedAttackEffect(gameEnv, firstEffectEvent);
        expect(firstEffectResult.requiresSelection).toBe(true);

        const costChoice = findTargetChoiceByEffectId(gameEnv, 'attack_effect_cost_destroyFriendlyUnit');
        const declineResult = resolveTargetChoice(gameEnv, costChoice, []);
        expect(declineResult.success).toBe(true);

        expect(findTargetChoiceByEffectId(gameEnv, 'attack_effect')).toBeFalsy();
        expect(gameEnv.getPlayer('playerId_2').zones.slot1.unit.damageReceived || 0).toBe(0);

        const secondEffectEvent = findQueuedAttackEffect(gameEnv);
        expect(secondEffectEvent?.data?.effect?.effectId).toBe('attack_reduce_enemy_ap');

        const secondEffectResult = resolveQueuedAttackEffect(gameEnv, secondEffectEvent);
        expect(secondEffectResult.requiresSelection).toBe(true);

        const pilotChoice = findTargetChoiceByEffectId(gameEnv, 'attack_reduce_enemy_ap');
        const pilotChoiceResult = resolveTargetChoice(gameEnv, pilotChoice, [pilotChoice.data.availableTargets[1]]);
        expect(pilotChoiceResult.success).toBe(true);

        expect(gameEnv.getPlayer('playerId_2').zones.slot2.unit.modifyAP).toBe(-2);
        expect(gameEnv.processingQueue.some((event) => event.type === EventType.ATTACK_PHASE_EFFECT_TRIGGERED)).toBe(false);
        expect(gameEnv.processingQueue.some((event) => event.type === EventType.PLAYER_ACTION)).toBe(true);
    });
});
