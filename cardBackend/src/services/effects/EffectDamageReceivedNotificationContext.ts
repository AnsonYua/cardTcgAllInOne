import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDamageReceivedTriggerContext } from '../../models/EffectDamageReceivedTriggerContext';

function readNotificationQueue(gameEnv: GameEnvironment): any[] {
    return Array.isArray((gameEnv as any)?.notificationQueue) ? (gameEnv as any).notificationQueue : [];
}

export function findLatestCardDamagedNotification(
    gameEnv: GameEnvironment,
    damagedCarduid: string
): Record<string, unknown> | null {
    const queue = readNotificationQueue(gameEnv);
    for (let i = queue.length - 1; i >= 0; i--) {
        const notification = queue[i] as any;
        if (!notification || notification.type !== 'CARD_DAMAGED') {
            continue;
        }
        if (String(notification?.payload?.carduid || '') !== damagedCarduid) {
            continue;
        }
        return notification as Record<string, unknown>;
    }
    return null;
}

export function snapshotLatestCardDamagedNotification(
    gameEnv: GameEnvironment,
    damagedCarduid: string
): Record<string, unknown> | null {
    const notification = findLatestCardDamagedNotification(gameEnv, damagedCarduid);
    if (!notification) {
        return null;
    }
    return JSON.parse(JSON.stringify(notification));
}

export function resolveEffectDamageReceivedNotificationContext(
    gameEnv: GameEnvironment,
    context: Pick<EffectDamageReceivedTriggerContext, 'damagedCarduid' | 'notificationOverride'>
): Record<string, unknown> | null {
    if (context.notificationOverride && typeof context.notificationOverride === 'object') {
        return context.notificationOverride;
    }

    if (context.damagedCarduid) {
        const matched = findLatestCardDamagedNotification(gameEnv, context.damagedCarduid);
        if (matched) {
            return matched;
        }
    }

    const queue = readNotificationQueue(gameEnv);
    return queue.length > 0 ? (queue[queue.length - 1] as Record<string, unknown>) : null;
}
