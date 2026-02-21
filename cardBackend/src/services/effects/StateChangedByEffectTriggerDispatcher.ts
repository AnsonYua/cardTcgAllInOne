import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { EffectUsageTracker } from './EffectUsageTracker';
import { DeployTargetManager } from '../DeployTargetManager';
import {
    StateChangedByEffectEventConditionEvaluator
} from './StateChangedByEffectEventConditionEvaluator';
import type { CardStateChangedByEffectContext } from './stateChanged/StateChangedByEffectTypes';
import { STATE_CHANGED_BY_EFFECT_TRIGGER_ADAPTERS } from './stateChanged/StateChangedByEffectTriggerAdapters';
import { shouldProcessStateChangedByEffectContext } from './stateChanged/StateChangedByEffectRuntimeFlags';
import { collectStateChangedByEffectSources } from './stateChanged/StateChangedByEffectSourceCollector';

type SourceCard = any;

export class StateChangedByEffectTriggerDispatcher {
    static process(
        gameEnv: GameEnvironment,
        context: CardStateChangedByEffectContext
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        if (!shouldProcessStateChangedByEffectContext(gameEnv, context)) {
            return { success: true };
        }

        const sources = collectStateChangedByEffectSources(gameEnv, context.targetPlayerId);
        for (const sourceCard of sources) {
            for (const adapter of STATE_CHANGED_BY_EFFECT_TRIGGER_ADAPTERS) {
                if (!adapter.matchesEvent(context)) {
                    continue;
                }

                const effects = EffectRuleCatalog.collectEffects(sourceCard.cardData, {
                    trigger: adapter.trigger,
                    fallbackEffectId: adapter.fallbackEffectId,
                    expectedTriggers: adapter.expectedTriggers,
                    requireAction: true,
                    defaultTargetScope: 'self'
                });

                for (const effectRule of effects) {
                    const normalized = ensureEffectDefaults({ ...effectRule }) as EffectDefinition;
                    if (!ContinuousEffectManager.sourceConditionsMet(normalized, sourceCard, gameEnv, context.targetPlayerId)) {
                        continue;
                    }

                    if (!StateChangedByEffectEventConditionEvaluator.eventConditionsSatisfied(
                        normalized.conditions,
                        context,
                        context.targetPlayerId,
                        sourceCard.carduid
                    )) {
                        continue;
                    }

                    const normalizedWithoutEvent = ensureEffectDefaults(
                        StateChangedByEffectEventConditionEvaluator.stripEventConditions(normalized)
                    );

                    if (!ContinuousEffectManager.validateEffectConditions(
                        normalizedWithoutEvent,
                        gameEnv,
                        context.targetPlayerId,
                        sourceCard
                    )) {
                        continue;
                    }

                    const restrictions = Array.isArray((normalized as any).restrictions)
                        ? ((normalized as any).restrictions as unknown[])
                        : [];
                    const usageKey = EffectUsageTracker.getUsageKey(normalized, adapter.fallbackEffectId);
                    if (restrictions.includes('once_per_turn')) {
                        if (!EffectUsageTracker.canUseOncePerTurn(sourceCard, usageKey, gameEnv.currentTurn)) {
                            continue;
                        }
                    }

                    const result = DeployTargetManager.processEffectWithTargetChoice(
                        gameEnv,
                        context.targetPlayerId,
                        sourceCard.carduid,
                        normalizedWithoutEvent
                    );
                    if (!result.success) {
                        return {
                            success: false,
                            error: result.error || `Failed to apply ${adapter.trigger} effect ${normalized.effectId}`
                        };
                    }

                    if (restrictions.includes('once_per_turn')) {
                        EffectUsageTracker.markUsedThisTurn(sourceCard, usageKey, gameEnv.currentTurn);
                    }

                    if (result.requiresSelection) {
                        return { success: true, requiresSelection: true };
                    }
                }
            }
        }

        return { success: true };
    }
}
