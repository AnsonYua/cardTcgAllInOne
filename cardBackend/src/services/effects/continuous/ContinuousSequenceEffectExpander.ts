// src/services/effects/continuous/ContinuousSequenceEffectExpander.ts
// Expands continuous "sequence" effects (parameters.steps) into concrete continuous effects.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../../utils/EffectNormalizationUtils';
import { ContinuousConditionalEffectExpander } from './ContinuousConditionalEffectExpander';
import { isSupportedContinuousAction, normalizeContinuousStep } from './ContinuousEffectExpansionUtils';

type ExpandContext = {
    gameEnv: GameEnvironment;
    player: any;
    sourceCard: any;
    sourcePlayerId: string;
    effectRule: EffectDefinition;
    validateEffectConditions: (effect: EffectDefinition, gameEnv: GameEnvironment, playerId: string, sourceCard: any) => boolean;
    createRegistryEntry: (effect: EffectDefinition, sourceCard: any, sourcePlayerId: string) => any;
};

export class ContinuousSequenceEffectExpander {
    static addToRegistry(ctx: ExpandContext): void {
        const steps = Array.isArray(ctx.effectRule.parameters?.steps)
            ? (ctx.effectRule.parameters!.steps as any[])
            : [];
        if (steps.length === 0) {
            return;
        }

        for (let index = 0; index < steps.length; index++) {
            const rawStep = steps[index];
            if (!rawStep || typeof rawStep.action !== 'string') {
                continue;
            }

            const step = normalizeContinuousStep(rawStep);

            if (step.action === 'conditional') {
                const derivedConditional: EffectDefinition = ensureEffectDefaults({
                    effectId: `${ctx.effectRule.effectId}_seq_${index}`,
                    type: ctx.effectRule.type,
                    trigger: 'continuous',
                    action: 'conditional',
                    target: step.target || ctx.effectRule.target,
                    timing: step.timing || ctx.effectRule.timing,
                    parameters: step.parameters || {},
                    conditions: ctx.effectRule.conditions || [],
                    sourceConditions: ctx.effectRule.sourceConditions || []
                } as any);

                ContinuousConditionalEffectExpander.addToRegistry({
                    ...ctx,
                    effectRule: derivedConditional
                });
                continue;
            }

            if (!isSupportedContinuousAction(step.action)) {
                continue;
            }

            const derived: EffectDefinition = ensureEffectDefaults({
                effectId: `${ctx.effectRule.effectId}_seq_${index}`,
                type: ctx.effectRule.type,
                trigger: 'continuous',
                action: step.action,
                target: step.target || ctx.effectRule.target,
                timing: step.timing || ctx.effectRule.timing,
                parameters: step.parameters || {},
                conditions: ctx.effectRule.conditions || [],
                sourceConditions: ctx.effectRule.sourceConditions || []
            } as any);

            if (!ctx.validateEffectConditions(derived, ctx.gameEnv, ctx.sourcePlayerId, ctx.sourceCard)) {
                continue;
            }

            const key = `${derived.effectId}_${ctx.sourceCard.carduid}`;
            if (ctx.player.effectRegistry[key]) {
                continue;
            }

            const entry = ctx.createRegistryEntry(derived, ctx.sourceCard, ctx.sourcePlayerId);
            ctx.player.effectRegistry[key] = entry;
            console.log(`  ➕ Added sequence step effect ${derived.effectId} from ${ctx.sourceCard.cardId} to player ${ctx.sourcePlayerId} registry`);
        }
    }
}
