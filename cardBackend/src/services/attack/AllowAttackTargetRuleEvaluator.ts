// src/services/attack/AllowAttackTargetRuleEvaluator.ts
// Shared helpers for evaluating allow_attack_target rule conditions.

import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';

export class AllowAttackTargetRuleEvaluator {
    static conditionsSatisfied(
        conditions: unknown,
        sourceSlotTotals: { totalAP: number }
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return true;
        }

        for (const raw of conditions) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }

            const typed = raw as Record<string, unknown>;
            const type = typeof typed.type === 'string' ? typed.type.toLowerCase() : '';

            if (type === 'sourceap') {
                const value = typed.value;
                if (typeof value === 'number') {
                    if (sourceSlotTotals.totalAP !== value) {
                        return false;
                    }
                    continue;
                }
                if (typeof value === 'string') {
                    if (!validateComparisonFilter(sourceSlotTotals.totalAP, value)) {
                        return false;
                    }
                    continue;
                }
                return false;
            }
        }

        return true;
    }
}

