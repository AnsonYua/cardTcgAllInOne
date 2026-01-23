// src/services/EventQueue/factories/EventIdUtils.ts

import type { EventType } from '../../../models/GameEnums';
import { EventPriority, EventStatus, type BaseGameEvent } from '../interfaces/GameEvent';

let eventIdCounter = 0;

export const nextCounterEventId = (prefix: string): string => {
    eventIdCounter += 1;
    return `${prefix}_${eventIdCounter}_${Date.now()}`;
};

export const generateEventId = (prefix: string, suffix?: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return suffix ? `${prefix}_${timestamp}_${suffix}` : `${prefix}_${timestamp}_${random}`;
};

export const createBaseEvent = <TData>(
    type: EventType,
    playerId: string,
    data: TData,
    options: {
        id?: string;
        status?: EventStatus;
        priority?: EventPriority;
    } = {}
): BaseGameEvent<TData> => {
    return {
        id: options.id || generateEventId(String(type).toLowerCase()),
        type,
        status: options.status || EventStatus.DECLARED,
        priority: options.priority || EventPriority.NORMAL,
        playerId,
        data,
        timestamp: Date.now()
    };
};
