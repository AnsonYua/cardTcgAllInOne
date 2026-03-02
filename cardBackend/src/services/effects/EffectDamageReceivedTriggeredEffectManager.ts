import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDamageReceivedTriggerContext } from '../../models/EffectDamageReceivedTriggerContext';
import { InPlayTriggeredEffectManager } from './InPlayTriggeredEffectManager';
import { resolveEffectDamageReceivedNotificationContext } from './EffectDamageReceivedNotificationContext';
import { withEventConditionNotificationOverride } from './EventConditionNotificationOverride';

export class EffectDamageReceivedTriggeredEffectManager {
    static execute(
        gameEnv: GameEnvironment,
        params: EffectDamageReceivedTriggerContext
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const { damagedPlayerId, sourcePlayerId, damagedCarduid, notificationOverride } = params;
        const latestNotification = resolveEffectDamageReceivedNotificationContext(gameEnv, { damagedCarduid, notificationOverride });
        return withEventConditionNotificationOverride(gameEnv, latestNotification, () => {
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
        });
    }
}
