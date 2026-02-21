// src/services/effects/continuous/ContinuousApReductionPreventionManager.ts
// Applies AP-reduction prevention as a continuous temporary effect refreshed by ContinuousEffectManager.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';

export class ContinuousApReductionPreventionManager {
    static applyToTargets(
        gameEnv: GameEnvironment,
        effectEntry: {
            sourceCarduid: string;
            sourcePlayerId: string;
            effectData: EffectDefinition;
        },
        targets: any[]
    ): number {
        const sourceController = typeof effectEntry.effectData?.parameters?.sourceController === 'string'
            ? effectEntry.effectData.parameters.sourceController
            : undefined;

        if (!sourceController) {
            return 0;
        }

        let appliedCount = 0;

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
                const prevention = tempEffect?.preventApReduction;
                if (!prevention || typeof prevention !== 'object') {
                    return false;
                }
                return prevention.sourceController === sourceController;
            });
            if (alreadyApplied) {
                continue;
            }

            const tempEffect = TemporaryEffectFactory.createApReductionPrevention(
                gameEnv,
                effectEntry.sourcePlayerId,
                effectEntry.sourceCarduid,
                effectEntry.effectData,
                { sourceController }
            );
            tempEffect.duration = 'CONTINUOUS';
            tempEffect.endOnSourceDestroyed = true;

            target.temporaryEffects.push(tempEffect);
            appliedCount += 1;
        }

        return appliedCount;
    }
}
