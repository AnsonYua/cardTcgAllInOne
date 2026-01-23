// src/services/effects/actions/EffectRestrictAttackActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { AttackRestrictionService } from '../../statusEffects/AttackRestrictionService';

export function applyRestrictAttackEffect(
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
        : typeof effect.parameters?.restrictions === 'string'
            ? effect.parameters.restrictions
            : 'cannot_attack';

    const duration = typeof effect.timing?.duration === 'string'
        ? effect.timing.duration
        : 'UNTIL_END_OF_TURN';

    for (const target of selectedTargets) {
        const resolvedTarget = TargetCardResolver.resolve(gameEnv, target);
        if (!resolvedTarget) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

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
