// src/services/effects/EffectApReductionPreventionUtils.ts

import type { TargetReference } from '../EventQueue/interfaces/GameEvent';

export class EffectApReductionPreventionUtils {
    static isApReductionPrevented(params: {
        targetCard: any;
        target: TargetReference;
        sourcePlayerId?: string;
    }): { prevented: boolean; preventedBySourceCarduid?: string } {
        const { targetCard, target, sourcePlayerId } = params;
        if (!sourcePlayerId) {
            return { prevented: false };
        }

        const tempEffects = targetCard?.temporaryEffects;
        if (!Array.isArray(tempEffects) || tempEffects.length === 0) {
            return { prevented: false };
        }

        for (const tempEffect of tempEffects) {
            const prevention = tempEffect?.preventApReduction;
            if (!prevention || typeof prevention !== 'object') {
                continue;
            }

            const controller = typeof prevention.sourceController === 'string'
                ? prevention.sourceController
                : undefined;
            if (controller === 'opponent') {
                if (target.playerId && sourcePlayerId === target.playerId) {
                    continue;
                }
            } else if (controller === 'self') {
                if (target.playerId && sourcePlayerId !== target.playerId) {
                    continue;
                }
            }

            return { prevented: true, preventedBySourceCarduid: tempEffect.sourceCarduid };
        }

        return { prevented: false };
    }
}
