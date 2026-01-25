// src/services/effects/TriggerDispatchUtils.ts
// Shared helper for dispatchers that enqueue a processing event and emit a matching frontend notification.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { GameNotificationManager } from '../GameNotificationManager';

export class TriggerDispatchUtils {
    static enqueueAndNotify(params: {
        gameEnv: GameEnvironment;
        triggerEvent: { id: string };
        notificationType: string;
        payload: Record<string, unknown>;
    }): void {
        const { gameEnv, triggerEvent, notificationType, payload } = params;

        gameEnv.enqueueForProcessing(triggerEvent as any);

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEventWithId(triggerEvent.id, notificationType, payload);
    }
}

