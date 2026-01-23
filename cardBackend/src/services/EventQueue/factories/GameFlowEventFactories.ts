// src/services/EventQueue/factories/GameFlowEventFactories.ts

import { EventType } from '../../../models/GameEnums';
import {
    EventPriority,
    EventStatus,
    type ActionStepPostPlayEvent,
    type AcknowledgeEventsEvent,
    type EndTurnEvent,
    type PlayerActionEvent,
    type PlayerActionEventData,
    type StepBeginEvent,
    type TurnEndEvent,
    type TurnStartEvent
} from '../interfaces/GameEvent';
import { nextCounterEventId } from './EventIdUtils';

export const createTurnStartEvent = (
    playerId: string,
    turnNumber: number,
    phase: string
): TurnStartEvent => {
    return {
        id: nextCounterEventId('turn_start'),
        type: EventType.TURN_CHANGE,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data: { playerId, turnNumber, phase }
    };
};

export const createTurnEndEvent = (
    playerId: string,
    turnNumber: number,
    nextPlayerId: string
): TurnEndEvent => {
    return {
        id: nextCounterEventId('turn_end'),
        type: EventType.TURN_CHANGE,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data: { playerId, turnNumber, nextPlayerId }
    };
};

export const createActionStepPostPlayEvent = (playerId: string): ActionStepPostPlayEvent => {
    return {
        id: nextCounterEventId('action_step_post_play'),
        type: EventType.ACTION_STEP_POST_PLAY,
        status: EventStatus.DECLARED,
        priority: EventPriority.LOW,
        timestamp: Date.now(),
        playerId,
        data: {
            actingPlayerId: playerId
        }
    };
};

export const createPlayerActionEvent = (
    playerId: string,
    actionType: string,
    extras: Partial<PlayerActionEventData> = {}
): PlayerActionEvent => {
    const sanitizedExtras: Partial<PlayerActionEventData> = { ...extras };
    if ('playerId' in sanitizedExtras) {
        delete (sanitizedExtras as Record<string, unknown>).playerId;
    }
    if ('actionType' in sanitizedExtras) {
        delete (sanitizedExtras as Record<string, unknown>).actionType;
    }

    const eventData: PlayerActionEventData = {
        playerId,
        actionType,
        ...sanitizedExtras
    };

    return {
        id: nextCounterEventId('player_action'),
        type: EventType.PLAYER_ACTION,
        status: EventStatus.DECLARED,
        priority: EventPriority.NORMAL,
        playerId,
        timestamp: Date.now(),
        data: eventData
    };
};

export const createStepBeginEvent = (
    step: string,
    playerId: string,
    allowsResponses: boolean = true
): StepBeginEvent => {
    return {
        id: nextCounterEventId('step_begin'),
        type: EventType.PHASE_ADVANCE,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data: { step, playerId, allowsResponses }
    };
};

export const createEndTurnEvent = (playerId: string, currentTurnNumber: number): EndTurnEvent => {
    return {
        id: nextCounterEventId('end_turn'),
        type: EventType.END_TURN,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data: { playerId, currentTurnNumber, timestamp: Date.now() }
    };
};

export const createAcknowledgeEventsEvent = (playerId: string, eventIds: string[]): AcknowledgeEventsEvent => {
    return {
        id: nextCounterEventId('acknowledge_events'),
        type: EventType.ACKNOWLEDGE_EVENTS,
        status: EventStatus.DECLARED,
        priority: EventPriority.NORMAL,
        playerId,
        timestamp: Date.now(),
        data: { eventIds, acknowledgedCount: 0 }
    };
};
