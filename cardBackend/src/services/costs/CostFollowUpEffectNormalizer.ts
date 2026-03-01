import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';

// Cost-gated "if you do" semantics:
// once the cost is paid, the follow-up effect is mandatory and should not re-run cost interception.
export function normalizeCostPaidFollowUpEffect(effect: EffectDefinition): EffectDefinition {
    return ensureEffectDefaults({
        ...effect,
        optional: false,
        cost: undefined
    } as any);
}
