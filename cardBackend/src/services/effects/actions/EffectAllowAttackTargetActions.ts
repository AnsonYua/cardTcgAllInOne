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

    const selectionValidation = validateSelectedTargetCount(effect, selectedTargets.length);
    if (!selectionValidation.success) {
        return selectionValidation;
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

function validateSelectedTargetCount(
    effect: EffectDefinition,
    selectedCount: number
): { success: boolean; error?: string } {
    const countConfig = effect?.target?.count;
    if (typeof countConfig === 'number' && countConfig > 0) {
        if (selectedCount !== countConfig) {
            return {
                success: false,
                error: `allow_attack_target requires exactly ${countConfig} selected target(s), got ${selectedCount}`
            };
        }
        return { success: true };
    }

    if (!countConfig || typeof countConfig !== 'object') {
        return { success: true };
    }

    const min = typeof (countConfig as any).min === 'number' ? (countConfig as any).min : 0;
    const max = typeof (countConfig as any).max === 'number' ? (countConfig as any).max : Number.MAX_SAFE_INTEGER;
    if (selectedCount < min || selectedCount > max) {
        return {
            success: false,
            error: `allow_attack_target requires selected target count within [${min}, ${max}], got ${selectedCount}`
        };
    }

    return { success: true };
}
