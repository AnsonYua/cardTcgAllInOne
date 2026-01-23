// src/services/EventQueue/factories/ChoiceEventFactories.ts

import { EventType } from '../../../models/GameEnums';
import {
    EventPriority,
    EventStatus,
    type BlockerChoiceEvent,
    type BlockerChoiceEventData,
    type BurstEffectChoiceEvent,
    type EffectDefinition,
    type OptionChoiceEvent,
    type OptionChoiceOption,
    type PlayerActionEvent,
    type TargetChoiceEvent,
    type TargetChoiceEventData,
    type TargetReference,
    type TokenChoiceEvent,
    type TokenChoiceOption
} from '../interfaces/GameEvent';
import { nextCounterEventId } from './EventIdUtils';

export const createBurstEffectChoiceEvent = (playerId: string, cards: Array<any>): BurstEffectChoiceEvent => {
    const firstCarduid = cards?.[0]?.carduid;
    return {
        id: nextCounterEventId('burst_choice'),
        type: EventType.BURST_EFFECT_CHOICE,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data: {
            playerId,
            availableTargets: cards,
            choiceId: `burst_choice_${Date.now()}`,
            userDecisionMade: false,
            userDecision: undefined,
            carduid: firstCarduid
        }
    };
};

export const createTargetChoiceEvent = (params: {
    playerId: string;
    sourceCarduid: string;
    effect: EffectDefinition;
    availableTargets: TargetReference[];
}): TargetChoiceEvent => {
    const { playerId, sourceCarduid, effect, availableTargets } = params;
    const effectKey = effect?.effectId || effect?.action || 'effect';
    const eventData: TargetChoiceEventData = {
        choiceId: `target_choice_${effectKey}_${Date.now()}`,
        userDecisionMade: false,
        sourceCarduid,
        effect,
        availableTargets
    };

    return {
        id: nextCounterEventId('target_choice'),
        type: EventType.TARGET_CHOICE,
        status: EventStatus.DECLARED,
        priority: EventPriority.IMMEDIATE,
        playerId,
        timestamp: Date.now(),
        data: eventData
    };
};

export const createTokenChoiceEvent = (params: {
    playerId: string;
    sourceCarduid: string;
    effect: EffectDefinition;
    availableChoices: TokenChoiceOption[];
}): TokenChoiceEvent => {
    const { playerId, sourceCarduid, effect, availableChoices } = params;
    const effectKey = effect?.effectId || effect?.action || 'effect';
    const eventData = {
        choiceId: `token_choice_${effectKey}_${Date.now()}`,
        userDecisionMade: false,
        sourceCarduid,
        effect,
        availableChoices
    };

    return {
        id: nextCounterEventId('token_choice'),
        type: EventType.TOKEN_CHOICE,
        status: EventStatus.DECLARED,
        priority: EventPriority.IMMEDIATE,
        playerId,
        timestamp: Date.now(),
        data: eventData
    };
};

export const createOptionChoiceEvent = (params: {
    playerId: string;
    sourceCarduid: string;
    effect: EffectDefinition;
    availableOptions: OptionChoiceOption[];
    context?: Record<string, unknown>;
}): OptionChoiceEvent => {
    const { playerId, sourceCarduid, effect, availableOptions, context } = params;
    const effectKey = effect?.effectId || effect?.action || 'effect';
    const eventData = {
        choiceId: `option_choice_${effectKey}_${Date.now()}`,
        userDecisionMade: false,
        sourceCarduid,
        effect,
        availableOptions,
        context
    };

    return {
        id: nextCounterEventId('option_choice'),
        type: EventType.OPTION_CHOICE,
        status: EventStatus.DECLARED,
        priority: EventPriority.IMMEDIATE,
        playerId,
        timestamp: Date.now(),
        data: eventData
    };
};

export const createBlockerChoiceEvent = (params: {
    blockingPlayerId: string;
    originalAttackEvent: PlayerActionEvent;
    availableTargets: TargetReference[];
}): BlockerChoiceEvent => {
    const { blockingPlayerId, originalAttackEvent, availableTargets } = params;
    const choiceId = `blocker_choice_${Date.now()}`;
    const eventData: BlockerChoiceEventData = {
        originalAttackEvent,
        availableTargets,
        blockingPlayerId,
        userDecisionMade: false,
        choiceId,
        userDecision: undefined
    };

    return {
        id: nextCounterEventId('blocker_choice'),
        type: EventType.BLOCKER_CHOICE,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId: blockingPlayerId,
        timestamp: Date.now(),
        data: eventData
    };
};
