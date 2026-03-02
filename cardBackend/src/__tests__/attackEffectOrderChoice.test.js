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

function setupGd02057AttackState({ includeFriendlyCostUnit = true } = {}) {
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

    if (includeFriendlyCostUnit) {
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'ST03-005_cost_unit_0002',
            playAs: 'unit'
        }).success).toBe(true);
    }

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

describe('Attack effect order choice', () => {
    test('queueAttackPhaseEffects schedules attack_effect_order OPTION_CHOICE when both unit and pilot are interactive', () => {
        const { gameEnv, attackEvent } = setupGd02057AttackState();

        const queueResult = AttackPhaseEffectManager.queueAttackPhaseEffects(gameEnv, attackEvent);
        expect(queueResult.success).toBe(true);
        expect(queueResult.queued).toBe(true);

        const optionChoice = findAttackOrderOptionChoice(gameEnv);
        expect(optionChoice).toBeTruthy();
        expect(optionChoice.data.headerText).toBe('Choose Effect Order');
        expect(optionChoice.data.promptText).toBe('Select which attack effect resolves first.');
        expect(optionChoice.data.context.kind).toBe('ATTACK_EFFECT_ORDER');
        expect(optionChoice.data.availableOptions).toHaveLength(2);
        expect(optionChoice.data.availableOptions.every((option) => typeof option.label === 'string')).toBe(true);
        expect(gameEnv.processingQueue.some((event) => event.type === EventType.ATTACK_PHASE_EFFECT_TRIGGERED)).toBe(false);
    });

    test('choosing unit effect first resolves cost/follow-up before pilot effect', () => {
        const { gameEnv, attackEvent } = setupGd02057AttackState();
        expect(AttackPhaseEffectManager.queueAttackPhaseEffects(gameEnv, attackEvent).success).toBe(true);

        const optionChoice = findAttackOrderOptionChoice(gameEnv);
        expect(resolveOptionChoice(gameEnv, optionChoice, 0).success).toBe(true);

        const firstEffectEvent = findQueuedAttackEffect(gameEnv);
        expect(firstEffectEvent.data.effect.effectId).toBe('attack_effect');

        const firstEffectResult = resolveQueuedAttackEffect(gameEnv, firstEffectEvent);
        expect(firstEffectResult.success).toBe(true);
        expect(firstEffectResult.requiresSelection).toBe(true);

        const costChoice = findTargetChoiceByEffectId(gameEnv, 'attack_effect_cost_destroyFriendlyUnit');
        expect(resolveTargetChoice(gameEnv, costChoice, [costChoice.data.availableTargets[0]]).success).toBe(true);

        const followUpChoice = findTargetChoiceByEffectId(gameEnv, 'attack_effect');
        expect(resolveTargetChoice(gameEnv, followUpChoice, [followUpChoice.data.availableTargets[0]]).success).toBe(true);

        const secondEffectEvent = findQueuedAttackEffect(gameEnv);
        expect(secondEffectEvent.data.effect.effectId).toBe('attack_reduce_enemy_ap');
        expect(resolveQueuedAttackEffect(gameEnv, secondEffectEvent).success).toBe(true);

        expect(gameEnv.processingQueue.some((event) => event.type === EventType.PLAYER_ACTION)).toBe(true);
    });

    test('choosing pilot effect first resolves pilot choice before unit cost flow', () => {
        const { gameEnv, attackEvent } = setupGd02057AttackState();
        expect(AttackPhaseEffectManager.queueAttackPhaseEffects(gameEnv, attackEvent).success).toBe(true);

        const optionChoice = findAttackOrderOptionChoice(gameEnv);
        expect(resolveOptionChoice(gameEnv, optionChoice, 1).success).toBe(true);

        const firstEffectEvent = findQueuedAttackEffect(gameEnv);
        expect(firstEffectEvent.data.effect.effectId).toBe('attack_reduce_enemy_ap');

        const firstEffectResult = resolveQueuedAttackEffect(gameEnv, firstEffectEvent);
        expect(firstEffectResult.success).toBe(true);
        expect(firstEffectResult.requiresSelection).toBe(true);

        const pilotChoice = findTargetChoiceByEffectId(gameEnv, 'attack_reduce_enemy_ap');
        expect(resolveTargetChoice(gameEnv, pilotChoice, [pilotChoice.data.availableTargets[1]]).success).toBe(true);
        expect(gameEnv.getPlayer('playerId_2').zones.slot2.unit.modifyAP).toBe(-2);

        const secondEffectEvent = findQueuedAttackEffect(gameEnv);
        expect(secondEffectEvent.data.effect.effectId).toBe('attack_effect');
        const secondEffectResult = resolveQueuedAttackEffect(gameEnv, secondEffectEvent);
        expect(secondEffectResult.requiresSelection).toBe(true);
    });

    test('skips order dialog when only one option is enabled and queues that effect directly', () => {
        const { gameEnv, attackEvent } = setupGd02057AttackState({ includeFriendlyCostUnit: false });
        expect(AttackPhaseEffectManager.queueAttackPhaseEffects(gameEnv, attackEvent).success).toBe(true);

        expect(findAttackOrderOptionChoice(gameEnv)).toBeFalsy();

        const firstEffectEvent = findQueuedAttackEffect(gameEnv);
        expect(firstEffectEvent).toBeTruthy();
        expect(firstEffectEvent.data.effect.effectId).toBe('attack_reduce_enemy_ap');
    });
});

