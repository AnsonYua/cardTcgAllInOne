import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from '../targets/TargetResolver';

export function overrideRequiresChoice(
    targetConfig: ResolvedTargetConfig,
    _availableTargets: TargetReference[],
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

    return undefined;
}

