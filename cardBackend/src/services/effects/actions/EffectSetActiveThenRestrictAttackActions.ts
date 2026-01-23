// src/services/effects/actions/EffectSetActiveThenRestrictAttackActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { GameNotificationManager } from '../../GameNotificationManager';
import { AttackRestrictionService } from '../../statusEffects/AttackRestrictionService';
import { UnitRestrictionUtils } from '../../restrictions/UnitRestrictionUtils';
import { RestrictionNotificationEmitter } from '../../restrictions/RestrictionNotificationEmitter';

export function applySetActiveThenRestrictAttackEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const restriction = typeof effect.parameters?.restriction === 'string'
        ? effect.parameters.restriction
        : 'cannot_attack';
    const duration = typeof effect.timing?.duration === 'string'
        ? effect.timing.duration
        : 'UNTIL_END_OF_TURN';

    const notificationManager = new GameNotificationManager(gameEnv);

    for (const target of selectedTargets) {
        const resolvedTarget = TargetCardResolver.resolve(gameEnv, target);
        if (!resolvedTarget) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

        if (UnitRestrictionUtils.cannotBeSetActive(resolvedTarget.card as any)) {
            RestrictionNotificationEmitter.emitSetActiveBlocked(gameEnv, {
                playerId: target.playerId,
                carduid: target.carduid,
                zone: target.zone,
                reason: 'restrict_set_active'
            });
            continue;
        }

        resolvedTarget.card.isRested = false;
        notificationManager.addNotificationEvent('CARD_SET_ACTIVE', {
            playerId: target.playerId,
            carduid: target.carduid,
            zone: target.zone,
            timestamp: Date.now()
        });

        AttackRestrictionService.applyAndNotify(gameEnv, {
            playerId: target.playerId,
            carduid: target.carduid,
            zone: target.zone,
            unit: resolvedTarget.card as any,
            restriction,
            duration,
            appliedBy: sourcePlayerId,
            sourceCarduid
        });
    }

    return { success: true };
}
