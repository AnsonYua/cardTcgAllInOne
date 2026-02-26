// src/services/effects/continuous/ContinuousConditionalEffectExpander.ts
// Expands continuous "conditional" effects (parameters.if/then) into concrete continuous effects.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../../utils/EffectNormalizationUtils';
import { hasEventTypeCondition, isSupportedContinuousAction, normalizeContinuousStep } from './ContinuousEffectExpansionUtils';

type ExpandContext = {
    gameEnv: GameEnvironment;
    player: any;
    sourceCard: any;
    sourcePlayerId: string;
    effectRule: EffectDefinition;
    validateEffectConditions: (effect: EffectDefinition, gameEnv: GameEnvironment, playerId: string, sourceCard: any) => boolean;
    createRegistryEntry: (effect: EffectDefinition, sourceCard: any, sourcePlayerId: string) => any;
};

export class ContinuousConditionalEffectExpander {
    static addToRegistry(ctx: ExpandContext): void {
        const params = (ctx.effectRule.parameters || {}) as Record<string, unknown>;
        const ifConditions = Array.isArray(params.if) ? (params.if as any[]) : [];
        const thenSteps = Array.isArray(params.then) ? (params.then as any[]) : [];
        if (thenSteps.length === 0) {
            return;
        }

        for (let index = 0; index < thenSteps.length; index++) {
            const step = thenSteps[index];
            if (!step || typeof step.action !== 'string') {
                continue;
            }

            const normalizedStep = normalizeContinuousStep(step);
            if (!normalizedStep || typeof normalizedStep.action !== 'string') {
                continue;
            }

            const derived: EffectDefinition = ensureEffectDefaults({
                effectId: `${ctx.effectRule.effectId}_then_${index}`,
                type: ctx.effectRule.type,
                trigger: 'continuous',
                action: normalizedStep.action,
                target: normalizedStep.target || ctx.effectRule.target,
                timing: normalizedStep.timing || ctx.effectRule.timing,
                parameters: normalizedStep.parameters || {},
                conditions: [...(ctx.effectRule.conditions || []), ...ifConditions],
                sourceConditions: ctx.effectRule.sourceConditions || [],
                restrictions: Array.isArray((ctx.effectRule as any).restrictions)
                    ? [ ...((ctx.effectRule as any).restrictions as unknown[]) ]
                    : undefined,
                optional: (ctx.effectRule as any).optional,
                windows: Array.isArray((ctx.effectRule as any).windows)
                    ? [ ...((ctx.effectRule as any).windows as unknown[]) ]
                    : undefined,
                cost: (ctx.effectRule as any).cost && typeof (ctx.effectRule as any).cost === 'object'
                    ? { ...((ctx.effectRule as any).cost as Record<string, unknown>) }
                    : (ctx.effectRule as any).cost
            } as any);

            const eventReactiveConditional = hasEventTypeCondition(ifConditions);
            const supportedContinuous = isSupportedContinuousAction(normalizedStep.action);

            if (!supportedContinuous && !eventReactiveConditional) {
                continue;
            }

            if (eventReactiveConditional) {
                (derived as any).__eventReactiveContinuous = true;
            }

            if (!eventReactiveConditional) {
                if (!ctx.validateEffectConditions(derived, ctx.gameEnv, ctx.sourcePlayerId, ctx.sourceCard)) {
                    continue;
                }
            }

            const key = `${derived.effectId}_${ctx.sourceCard.carduid}`;
            if (ctx.player.effectRegistry[key]) {
                continue;
            }

            const entry = ctx.createRegistryEntry(derived, ctx.sourceCard, ctx.sourcePlayerId);
            ctx.player.effectRegistry[key] = entry;
            console.log(`  ➕ Added conditional effect ${derived.effectId} from ${ctx.sourceCard.cardId} to player ${ctx.sourcePlayerId} registry`);
        }
    }
}
