import type { GameEnvironment } from '../../models/GameEnvironment';
import { InPlayTriggeredEffectManager } from './InPlayTriggeredEffectManager';

export class EffectDamageReceivedTriggeredEffectManager {
    static execute(
        gameEnv: GameEnvironment,
        params: {
            damagedPlayerId: string;
            sourcePlayerId: string;
        }
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const { damagedPlayerId, sourcePlayerId } = params;

        const queue = Array.isArray((gameEnv as any)?.notificationQueue) ? (gameEnv as any).notificationQueue : [];
        const latestNotification = queue.length > 0 ? queue[queue.length - 1] : null;
        const hadOverride = Object.prototype.hasOwnProperty.call(gameEnv as any, 'eventConditionNotificationOverride');
        const previousOverride = (gameEnv as any).eventConditionNotificationOverride;

        if (latestNotification && typeof latestNotification === 'object') {
            (gameEnv as any).eventConditionNotificationOverride = latestNotification;
        }

        try {
            return InPlayTriggeredEffectManager.processForPlayer({
                gameEnv,
                playerId: damagedPlayerId,
                trigger: 'EFFECT_DAMAGE_RECEIVED',
                fallbackEffectId: 'effect_damage_received',
                defaultTargetScope: 'self',
                preFilter: (rawRule) => {
                    const parameters = rawRule['parameters'];
                    const damageSource = parameters && typeof parameters === 'object'
                        ? (parameters as any).damageSource
                        : undefined;
                    const requiresEnemySource = typeof damageSource === 'string' && damageSource.toUpperCase() === 'ENEMY';
                    return requiresEnemySource ? sourcePlayerId !== damagedPlayerId : true;
                }
            });
        } finally {
            if (hadOverride) {
                (gameEnv as any).eventConditionNotificationOverride = previousOverride;
            } else {
                delete (gameEnv as any).eventConditionNotificationOverride;
            }
        }
    }
}
