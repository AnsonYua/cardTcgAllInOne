// src/services/effects/attack/AttackConditionEvaluator.ts
// Centralizes ATTACK_PHASE-only condition evaluation that depends on battle/action context.

import type { EffectDefinition, PlayerActionEvent } from '../../EventQueue/interfaces/GameEvent';
import { validateComparisonFilter } from '../../../utils/EffectNormalizationUtils';
import { getSlotTotals } from '../../../utils/FieldValueCalculator';
import type { GameEnvironment } from '../../../models/GameEnvironment';
import { ConditionEvaluators } from '../../conditions/ConditionEvaluators';

export interface AttackConditionContext {
    gameEnv: GameEnvironment;
    playerId: string;
    attackEvent: PlayerActionEvent;
    sourceSlot: any;
}

export class AttackConditionEvaluator {
    static conditionsSatisfied(
        effect: EffectDefinition,
        context: AttackConditionContext
    ): boolean {
        const { gameEnv, playerId, attackEvent, sourceSlot } = context;
        const conditions = Array.isArray(effect.conditions) ? effect.conditions : [];
        if (conditions.length === 0) {
            return true;
        }

        const eventData = attackEvent.data || {};
        const actionType = typeof (eventData as any).actionType === 'string' ? ((eventData as any).actionType as string) : '';
        const targetCardType = actionType === 'attackUnit' ? 'unit' : actionType === 'attackShieldArea' ? 'player' : '';
        const { totalAP } = getSlotTotals(sourceSlot);
        const sourceUnit = sourceSlot?.unit;
        const sourceLevel = typeof sourceUnit?.cardData?.level === 'number' ? (sourceUnit.cardData.level as number) : 0;
        const sourceDamaged = typeof sourceUnit?.damageReceived === 'number' ? sourceUnit.damageReceived > 0 : false;

        for (const raw of conditions) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }

            const typed = raw as Record<string, unknown>;
            const type = typeof typed.type === 'string' ? typed.type : '';

            if (type === 'attackTargetCardType') {
                const expected = typeof typed.value === 'string' ? typed.value.toLowerCase() : '';
                if (!expected) {
                    continue;
                }
                if (targetCardType !== expected) {
                    return false;
                }
                continue;
            }

            if (type === 'sourceAp') {
                if (typeof typed.value === 'number') {
                    if (totalAP !== typed.value) {
                        return false;
                    }
                    continue;
                }
                if (typeof typed.value === 'string') {
                    if (!validateComparisonFilter(totalAP, typed.value)) {
                        return false;
                    }
                }
                continue;
            }

            if (type === 'sourceDamaged') {
                const expected = typeof typed.value === 'boolean' ? typed.value : true;
                if (sourceDamaged !== expected) {
                    return false;
                }
                continue;
            }

            if (type === 'sourceLevel') {
                if (typeof typed.value === 'number') {
                    if (sourceLevel !== typed.value) {
                        return false;
                    }
                    continue;
                }
                if (typeof typed.value === 'string') {
                    if (!validateComparisonFilter(sourceLevel, typed.value)) {
                        return false;
                    }
                }
                continue;
            }

            if (type === 'unitsInPlayWithStatus') {
                const excludeSource = typed.excludeSource === true;
                const excludeCarduid = excludeSource && sourceUnit?.carduid ? sourceUnit.carduid : undefined;
                if (!ConditionEvaluators.evaluateUnitsInPlayWithStatusCondition(
                    gameEnv,
                    playerId,
                    typed,
                    excludeCarduid
                )) {
                    return false;
                }
                continue;
            }
        }

        return true;
    }
}
