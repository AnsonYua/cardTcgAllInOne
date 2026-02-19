import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from '../targets/TargetResolver';

function isDeterministicSourceAllowAttackTarget(
    action: string,
    scopeValue: string,
    targetType: string,
    targetCount: number,
    availableTargets: TargetReference[]
): boolean {
    return (
        action === 'allow_attack_target' &&
        (scopeValue === 'source' || scopeValue === 'source_paired_unit') &&
        targetType === 'unit' &&
        targetCount === 1 &&
        availableTargets.length <= 1
    );
}

export function overrideRequiresChoice(
    targetConfig: ResolvedTargetConfig,
    availableTargets: TargetReference[],
    effect: EffectDefinition
): boolean | undefined {
    const action = typeof effect.action === 'string' ? effect.action.toLowerCase() : '';
    const trigger = typeof effect.trigger === 'string' ? effect.trigger.toUpperCase() : '';
    const scopeValue = typeof targetConfig.scope === 'string' ? targetConfig.scope.toLowerCase() : '';
    const targetType = typeof targetConfig.type === 'string' ? targetConfig.type.toLowerCase() : '';

    // UX rule: auto-select a valid energy when setting resources active at end of turn (no player prompt).
    // Keeps END_OF_TURN "setActive" effects from interrupting turn flow.
    if (trigger === 'END_OF_TURN' && action === 'setactive' && targetType === 'energy' && scopeValue.startsWith('self')) {
        return false;
    }

    // Data rule: scopes like "any_all_unit" are intended to auto-apply to *all* matching units (no player prompt),
    // even when the card data omits an explicit count.
    if (scopeValue === 'any_all_unit') {
        return false;
    }

    // Self-referential allow_attack_target permissions with deterministic targeting
    // should auto-apply (no pre-choice dialog), even when effect.optional=true.
    if (isDeterministicSourceAllowAttackTarget(action, scopeValue, targetType, targetConfig.count, availableTargets)) {
        return false;
    }

    return undefined;
}
