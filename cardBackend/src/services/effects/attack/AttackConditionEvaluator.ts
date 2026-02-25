// src/services/effects/attack/AttackConditionEvaluator.ts
// Centralizes ATTACK_PHASE-only condition evaluation that depends on battle/action context.

import type { EffectDefinition, PlayerActionEvent } from '../../EventQueue/interfaces/GameEvent';
import { validateComparisonFilter } from '../../../utils/EffectNormalizationUtils';
import { getSlotTotals } from '../../../utils/FieldValueCalculator';
import type { GameEnvironment } from '../../../models/GameEnvironment';
import { ConditionEvaluators } from '../../conditions/ConditionEvaluators';
import { SlotHealthStorage } from '../../health/SlotHealthStorage';
import { EffectConditionEvaluator } from '../../conditions/EffectConditionEvaluator';
import { normalizeConditionTypeAlias } from '../schema/EffectSchema';
import { EffectiveSourceLevelResolver } from '../../conditions/EffectiveSourceLevelResolver';

export interface AttackConditionContext {
    gameEnv: GameEnvironment;
    playerId: string;
    attackEvent: PlayerActionEvent;
    sourceSlot: any;
    sourceCard?: any;
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
        const sourceDamaged = SlotHealthStorage.getSharedDamage(sourceSlot) > 0;
        const sourceCard = context.sourceCard || sourceUnit;
        const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
        const sourceLevel = sourceCarduid
            ? EffectiveSourceLevelResolver.resolve(gameEnv, sourceCarduid, effect.sourceLevelScope)
            : null;

        for (const raw of conditions) {
            if (!raw || typeof raw !== 'object') {
                return false;
            }

            const typed = raw as Record<string, unknown>;
            const rawType = typeof typed.type === 'string' ? typed.type : '';
            const type = normalizeConditionTypeAlias(rawType) || '';

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
                if (sourceLevel === null) {
                    return false;
                }
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

            if (!EffectConditionEvaluator.validateEffectConditions(
                { ...effect, conditions: [typed] },
                gameEnv,
                playerId,
                sourceCard
            )) {
                return false;
            }
        }

        return true;
    }
}
