// src/services/attack/AllowAttackTargetRuleEvaluator.ts
// Shared helpers for evaluating allow_attack_target rule conditions.

import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';

export class AllowAttackTargetRuleEvaluator {
    private static resolveDynamicSourceApFilter(filter: string, sourceAp: number): string | null {
        const match = filter.match(/^(<=|>=|<|>|==|!=)\s*(SOURCE_AP|sourceAp)$/);
        if (!match) {
            return null;
        }
        return `${match[1]}${sourceAp}`;
    }

    private static resolveDynamicSourceLevelFilter(filter: string, sourceLevel: number): string | null {
        const match = filter.match(/^(<=|>=|<|>|==|!=)\s*(SOURCE_LEVEL|sourceLevel)$/);
        if (!match) {
            return null;
        }
        return `${match[1]}${sourceLevel}`;
    }

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

    static ruleAllowsTarget(params: {
        sourceSlotTotals: { totalAP: number };
        sourceLevel: number;
        targetLevel: number;
        targetTotalAp: number;
        targetDamaged: boolean;
        rule: { conditions?: unknown; parameters?: unknown };
    }): boolean {
        const { sourceSlotTotals, sourceLevel, targetLevel, targetTotalAp, targetDamaged, rule } = params;

        if (!this.conditionsSatisfied(rule?.conditions, sourceSlotTotals)) {
            return false;
        }

        const rawParams = rule?.parameters;
        const parameters = rawParams && typeof rawParams === 'object' ? (rawParams as Record<string, unknown>) : {};

        const status = typeof parameters.status === 'string' ? parameters.status.toLowerCase() : '';
        if (status && status !== 'active') {
            return false;
        }

        if (parameters.level) {
            if (typeof parameters.level !== 'string') {
                return false;
            }
            const resolvedLevelFilter =
                this.resolveDynamicSourceLevelFilter(parameters.level, sourceLevel) || parameters.level;
            if (!validateComparisonFilter(targetLevel, resolvedLevelFilter)) {
                return false;
            }
        }

        if (parameters.ap) {
            if (typeof parameters.ap === 'number') {
                if (targetTotalAp !== parameters.ap) {
                    return false;
                }
            } else if (typeof parameters.ap === 'string') {
                const resolvedApFilter =
                    this.resolveDynamicSourceApFilter(parameters.ap, sourceSlotTotals.totalAP) || parameters.ap;
                if (!validateComparisonFilter(targetTotalAp, resolvedApFilter)) {
                    return false;
                }
            } else {
                return false;
            }
        }

        if (typeof parameters.damaged === 'boolean') {
            if (parameters.damaged !== targetDamaged) {
                return false;
            }
        }

        return true;
    }

    static canGrantActiveTargetPermission(rule: { parameters?: unknown }): boolean {
        const rawParams = rule?.parameters;
        const parameters = rawParams && typeof rawParams === 'object' ? (rawParams as Record<string, unknown>) : {};

        if (parameters.allowActiveTarget === true) {
            return true;
        }

        if (typeof parameters.status === 'string' && parameters.status.toLowerCase() === 'active') {
            return true;
        }

        if (typeof parameters.level === 'string') {
            return true;
        }

        if (typeof parameters.ap === 'number' || typeof parameters.ap === 'string') {
            return true;
        }

        if (typeof parameters.damaged === 'boolean') {
            return true;
        }

        return false;
    }
}
