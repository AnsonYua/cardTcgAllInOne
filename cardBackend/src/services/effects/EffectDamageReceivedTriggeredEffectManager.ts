import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDamageReceivedTriggerContext } from '../../models/EffectDamageReceivedTriggerContext';
import { InPlayTriggeredEffectManager } from './InPlayTriggeredEffectManager';
import { resolveEffectDamageReceivedNotificationContext } from './EffectDamageReceivedNotificationContext';

export class EffectDamageReceivedTriggeredEffectManager {
    static execute(
        gameEnv: GameEnvironment,
        params: EffectDamageReceivedTriggerContext
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const { damagedPlayerId, sourcePlayerId, damagedCarduid, notificationOverride } = params;
        const latestNotification = resolveEffectDamageReceivedNotificationContext(gameEnv, { damagedCarduid, notificationOverride });
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
