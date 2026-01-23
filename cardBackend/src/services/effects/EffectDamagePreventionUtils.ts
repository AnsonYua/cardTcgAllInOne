// src/services/effects/EffectDamagePreventionUtils.ts

import { CardDatabaseManager } from '../../models/CardSystem';
import type { TargetReference } from '../EventQueue/interfaces/GameEvent';

export class EffectDamagePreventionUtils {
    static isEffectDamagePrevented(params: {
        targetCard: any;
        target: TargetReference;
        sourcePlayerId: string;
        sourceCarduid?: string;
    }): { prevented: boolean; preventedBySourceCarduid?: string } {
        const { targetCard, target, sourcePlayerId, sourceCarduid } = params;

        const tempEffects = targetCard?.temporaryEffects;
        if (!Array.isArray(tempEffects) || tempEffects.length === 0) {
            return { prevented: false };
        }

        const sourceCardType = sourceCarduid
            ? CardDatabaseManager.getCardDetailsFromCarduid(sourceCarduid)?.cardType
            : undefined;

        for (const tempEffect of tempEffects) {
            const prevention = tempEffect?.preventEffectDamage;
            if (!prevention || typeof prevention !== 'object') {
                continue;
            }

            const requiredType = typeof prevention.sourceCardType === 'string' ? prevention.sourceCardType : undefined;
            if (requiredType && sourceCardType && requiredType !== sourceCardType) {
                continue;
            }
            if (requiredType && !sourceCardType) {
                continue;
            }

            const controller = typeof prevention.sourceController === 'string' ? prevention.sourceController : undefined;
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
