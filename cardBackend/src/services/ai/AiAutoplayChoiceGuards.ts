import { GameEnvironment } from '../../models/GameEnvironment';
import { CHOICE_EVENT_TYPES } from './AiTypes';
import { EventStatus, GameEvent } from '../EventQueue/interfaces/GameEvent';

type ChoiceEventData = {
    blockingPlayerId?: string;
    playerId?: string;
};

const isDeclaredChoiceEvent = (event: GameEvent): boolean =>
    event.status === EventStatus.DECLARED && CHOICE_EVENT_TYPES.has(String(event.type));

export const getChoiceOwner = (event: GameEvent): string | null => {
    if (!event) return null;
    if (typeof event.playerId === 'string' && event.playerId.length > 0) {
        return event.playerId;
    }
    const data = (event.data && typeof event.data === 'object' && !Array.isArray(event.data))
        ? (event.data as ChoiceEventData)
        : {};
    if (typeof data.blockingPlayerId === 'string' && data.blockingPlayerId.length > 0) {
        return data.blockingPlayerId;
    }
    if (typeof data.playerId === 'string' && data.playerId.length > 0) {
        return data.playerId;
    }
    return null;
};

export const hasPendingChoiceForNonAi = (gameEnv: GameEnvironment, aiPlayerIds: string[]): boolean => {
    const declaredChoices = Array.isArray(gameEnv.processingQueue)
        ? gameEnv.processingQueue.filter((event) => isDeclaredChoiceEvent(event))
        : [];

    return declaredChoices.some((event) => {
        const owner = getChoiceOwner(event);
        return Boolean(owner && !aiPlayerIds.includes(owner));
    });
};

export const getPendingAiChoiceOwners = (gameEnv: GameEnvironment, aiPlayerIds: string[]): string[] => {
    const aiSet = new Set(aiPlayerIds);
    const owners: string[] = [];

    const pushOwner = (owner: string | null): void => {
        if (!owner || !aiSet.has(owner) || owners.includes(owner)) {
            return;
        }
        owners.push(owner);
    };

    const declaredChoices = Array.isArray(gameEnv.processingQueue)
        ? gameEnv.processingQueue.filter((event) => isDeclaredChoiceEvent(event))
        : [];

    for (const event of declaredChoices) {
        pushOwner(getChoiceOwner(event));
    }

    if (owners.length > 0) {
        return owners;
    }

    if (!Array.isArray(gameEnv.notificationQueue)) {
        return owners;
    }

    for (const notification of gameEnv.notificationQueue) {
        if (!notification || !CHOICE_EVENT_TYPES.has(String(notification.type))) {
            continue;
        }

        const payload = (notification.payload && typeof notification.payload === 'object' && !Array.isArray(notification.payload))
            ? (notification.payload as ChoiceEventData & { isCompleted?: boolean })
            : {};

        if (payload.isCompleted === true) {
            continue;
        }

        pushOwner(typeof payload.playerId === 'string' ? payload.playerId : null);
    }

    return owners;
};
