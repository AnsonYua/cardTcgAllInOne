import type { GameEnvironment } from '../../models/GameEnvironment';

export function withEventConditionNotificationOverride<T>(
    gameEnv: GameEnvironment,
    notificationOverride: Record<string, unknown> | null | undefined,
    callback: () => T
): T {
    const hadOverride = Object.prototype.hasOwnProperty.call(gameEnv as any, 'eventConditionNotificationOverride');
    const previousOverride = (gameEnv as any).eventConditionNotificationOverride;

    try {
        if (notificationOverride && typeof notificationOverride === 'object') {
            (gameEnv as any).eventConditionNotificationOverride = notificationOverride;
        } else {
            delete (gameEnv as any).eventConditionNotificationOverride;
        }

        return callback();
    } finally {
        if (hadOverride) {
            (gameEnv as any).eventConditionNotificationOverride = previousOverride;
        } else {
            delete (gameEnv as any).eventConditionNotificationOverride;
        }
    }
}
