// src/services/costs/CostChoiceUtils.ts
// Shared helpers for deciding whether a cost flow should enqueue a TARGET_CHOICE event.

import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';

export class CostChoiceUtils {
    static shouldEnqueueChoice(effect: EffectDefinition, availableCount: number, requiredCount: number): boolean {
        // When effect.optional is true, player must be able to decline paying the cost.
        // When there are extra eligible cards, player must choose which ones to pay.
        return effect.optional === true || availableCount > requiredCount;
    }
}

