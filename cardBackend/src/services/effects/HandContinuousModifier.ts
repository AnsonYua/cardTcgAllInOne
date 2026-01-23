// src/services/effects/HandContinuousModifier.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ConditionEvaluators } from '../conditions/ConditionEvaluators';
import { EffectScalingUtils } from './EffectScalingUtils';

export class HandContinuousModifier {
    static applyModifiersForHandCardPlay(
        gameEnv: GameEnvironment,
        playerId: string,
        cardData: any
    ): any {
        if (!cardData || !cardData.effects || !Array.isArray(cardData.effects.rules)) {
            return cardData;
        }

        const rules: EffectDefinition[] = cardData.effects.rules as EffectDefinition[];
        const handRules = rules.filter(rule => {
            const trigger = rule.trigger;
            const type = rule.type;
            const scope = rule.target?.scope;
            return trigger === 'continuous'
                && type === 'continuous'
                && typeof scope === 'string'
                && scope.includes('hand');
        });

        if (handRules.length === 0) {
            return cardData;
        }

        let effectiveCost = typeof cardData.cost === 'number' ? cardData.cost : 0;
        let effectiveLevel = typeof cardData.level === 'number' ? cardData.level : 0;

        for (const rule of handRules) {
            const normalizedRule = ensureEffectDefaults(rule);
            if (!this.conditionsMet(gameEnv, playerId, normalizedRule.conditions || [])) {
                continue;
            }

            const baseValue = typeof normalizedRule.parameters?.value === 'number'
                ? normalizedRule.parameters.value
                : 0;
            const scalingFactor = EffectScalingUtils.resolveScalingFactor(
                gameEnv,
                playerId,
                normalizedRule.parameters?.scaling
            );
            const delta = baseValue * scalingFactor;

            if (normalizedRule.action === 'modifyCost') {
                effectiveCost = Math.max(0, effectiveCost + delta);
            }

            if (normalizedRule.action === 'modifyLevel') {
                effectiveLevel = Math.max(0, effectiveLevel + delta);
            }
        }

        if (effectiveCost === cardData.cost && effectiveLevel === cardData.level) {
            return cardData;
        }

        return {
            ...cardData,
            cost: effectiveCost,
            level: effectiveLevel
        };
    }

    private static conditionsMet(
        gameEnv: GameEnvironment,
        playerId: string,
        conditions: unknown[]
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return true;
        }

        for (const condition of conditions) {
            if (!condition || typeof condition !== 'object') {
                return false;
            }

            const typedCondition = condition as Record<string, unknown>;
            const ok = ConditionEvaluators.evaluateHandContinuousCondition(gameEnv, playerId, typedCondition);
            if (!ok) {
                return false;
            }
        }

        return true;
    }
}
