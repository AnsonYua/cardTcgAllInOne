// src/services/effects/continuous/ContinuousEffectDamagePreventionManager.ts
// Applies effect-damage prevention as a temporary effect refreshed via ContinuousEffectManager.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { GameNotificationManager } from '../../GameNotificationManager';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';

export class ContinuousEffectDamagePreventionManager {
    static applyToTargets(
        gameEnv: GameEnvironment,
        effectEntry: {
            sourceCarduid: string;
            sourcePlayerId: string;
            effectData: EffectDefinition;
        },
        targets: any[]
    ): number {
        const sourceCardType = typeof effectEntry.effectData?.parameters?.sourceCardType === 'string'
            ? effectEntry.effectData.parameters.sourceCardType
            : undefined;
        const sourceController = typeof effectEntry.effectData?.parameters?.sourceController === 'string'
            ? effectEntry.effectData.parameters.sourceController
            : undefined;

        if (!sourceCardType && !sourceController) {
            return 0;
        }

        const appliedTargets: Array<{ carduid: string; zone?: string; playerId?: string }> = [];

        for (const target of targets) {
            if (!target?.carduid || typeof target.carduid !== 'string') {
                continue;
            }

            if (!Array.isArray(target.temporaryEffects)) {
                target.temporaryEffects = [];
            }

            const alreadyApplied = target.temporaryEffects.some((tempEffect: any) => {
                if (tempEffect?.sourceCarduid !== effectEntry.sourceCarduid) {
                    return false;
                }
                const prevention = tempEffect?.preventEffectDamage;
                if (!prevention || typeof prevention !== 'object') {
                    return false;
                }
                return prevention.sourceCardType === sourceCardType
                    && prevention.sourceController === sourceController;
            });

            if (alreadyApplied) {
                continue;
            }

            const tempEffect = TemporaryEffectFactory.createEffectDamagePrevention(
                gameEnv,
                effectEntry.sourcePlayerId,
                effectEntry.sourceCarduid,
                effectEntry.effectData,
                { sourceCardType, sourceController }
            );
            tempEffect.duration = 'CONTINUOUS';
            tempEffect.endOnSourceDestroyed = true;

            target.temporaryEffects.push(tempEffect);
            const owner = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
            appliedTargets.push({
                carduid: target.carduid,
                zone: target.zone,
                playerId: owner?.found ? owner.playerId : undefined
            });
        }

        if (appliedTargets.length > 0) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'EFFECT_DAMAGE_PREVENTION_GRANTED',
                {
                    playerId: effectEntry.sourcePlayerId,
                    sourceCarduid: effectEntry.sourceCarduid,
                    targets: appliedTargets,
                    sourceCardType,
                    sourceController,
                    duration: effectEntry.effectData.timing?.duration || 'UNTIL_END_OF_TURN',
                    timestamp: Date.now()
                },
                'normal'
            );
        }

        return appliedTargets.length;
    }
}
