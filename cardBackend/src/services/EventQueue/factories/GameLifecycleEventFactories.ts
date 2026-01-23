// src/services/EventQueue/factories/GameLifecycleEventFactories.ts

import { EventType } from '../../../models/GameEnums';
import { EventPriority, EventStatus, type JoinGameEvent, type StartGameEvent } from '../interfaces/GameEvent';
import { nextCounterEventId } from './EventIdUtils';

export const createStartGameEvent = (playerId: string, gameId: string): StartGameEvent => {
    return {
        id: nextCounterEventId('start_game'),
        type: EventType.CREATE_GAME,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data: { playerId, gameId, timestamp: Date.now() }
    };
};

export const createJoinGameEvent = (playerId: string, gameId: string): JoinGameEvent => {
    return {
        id: nextCounterEventId('join_game'),
        type: EventType.JOIN_GAME,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data: { playerId, gameId, timestamp: Date.now() }
    };
};
