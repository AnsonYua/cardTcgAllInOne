import { GameEnvironment } from '../../../models/GameEnvironment';
import { UnitZoneCard } from '../../../models/CardSystem';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import {
    applyAllowAttackTargetUnitOverrides,
    normalizeAllowAttackTargetPermission
} from '../../attack/AllowAttackTargetPermissionUtils';

export function applyAllowAttackTargetEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (!sourceCarduid) {
        return { success: false, error: 'allow_attack_target requires a sourceCarduid' };
    }

    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const permission = normalizeAllowAttackTargetPermission(effect.parameters);

    for (const target of selectedTargets) {
        const resolved = TargetCardResolver.resolve(gameEnv, target);
        if (!resolved) {
            return { success: false, error: `Target card ${target.carduid} not found for allow_attack_target` };
        }

        if (resolved.kind !== 'unit') {
            return { success: false, error: `allow_attack_target can only be applied to units (got ${resolved.kind})` };
        }

        const targetCard = resolved.card as UnitZoneCard;
        if (!Array.isArray(targetCard.temporaryEffects)) {
            targetCard.temporaryEffects = [];
        }

        targetCard.temporaryEffects.push(
            TemporaryEffectFactory.createAllowAttackTarget(
                gameEnv,
                sourcePlayerId,
                sourceCarduid,
                effect
            )
        );

        applyAllowAttackTargetUnitOverrides(targetCard, permission);
    }

    return { success: true };
}
