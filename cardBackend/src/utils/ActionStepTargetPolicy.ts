import { ActionStepTargetSummary } from '../models/BattleContext';
import { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';
import { isPlayOrActivatedEffect } from './EffectTypeRouter';
import { GameEnvironment } from '../models/GameEnvironment';
import { EffectSourceConditionEvaluator } from '../services/conditions/EffectSourceConditionEvaluator';

export type ActionStepZoneType = ActionStepTargetSummary['zoneType'];

export interface ActionStepEffectFilterContext {
    availableEnergy: number;
    currentTurn: number;
    gameEnv?: GameEnvironment;
    sourcePlayerId?: string;
    sourceCard?: {
        carduid: string;
        [key: string]: unknown;
    };
    sourceCardState?: {
        isRested?: boolean;
        effectUsage?: Record<string, { lastUsedTurn?: number }>;
    };
}

export function extractActionStepEffectIds(
    effects: EffectDefinition[],
    zoneType: ActionStepZoneType,
    context: ActionStepEffectFilterContext
): string[] {
    const actionEffectIds: string[] = [];

    for (const effect of effects) {
        if (effectSupportsActionStep(effect, zoneType, context)) {
            actionEffectIds.push(effect.effectId || effect.action || 'action_step_effect');
        }
    }

    return actionEffectIds;
}

function effectSupportsActionStep(
    effect: EffectDefinition,
    zoneType: ActionStepZoneType,
    context: ActionStepEffectFilterContext
): boolean {
    // Action step targets are meant to represent *player-triggered* decisions (play/activate).
    // Exclude triggered/static rules so we don't block battle flow waiting for confirmations.
    if (!isPlayOrActivatedEffect(effect)) {
        return false;
    }

    // "Play" effects represent playing a card (typically from hand). Cards sitting in slots/base
    // should not advertise their "play" rules as action step options.
    if (effect.type === 'play' && zoneType !== 'hand') {
        return false;
    }

    if (effect.type === 'activated') {
        // Activated abilities can execute from unit/base/pilot sources.
        if (zoneType !== 'unit' && zoneType !== 'base' && zoneType !== 'pilot') {
            return false;
        }

        if (!canActivateNow(effect, zoneType, context)) {
            return false;
        }
    }

    if (!sourceConditionsAllow(effect, zoneType, context)) {
        return false;
    }

    const windows = Array.isArray(effect.timing?.windows)
        ? effect.timing!.windows!.map(window => typeof window === 'string' ? window.toUpperCase() : window)
        : [];

    if (windows.includes('ACTION_STEP')) {
        return true;
    }

    const actionTurn = typeof effect.timing?.actionTurn === 'string'
        ? effect.timing.actionTurn.toUpperCase()
        : undefined;

    return actionTurn === 'ACTION_STEP';
}

function canActivateNow(effect: EffectDefinition, zoneType: ActionStepZoneType, context: ActionStepEffectFilterContext): boolean {
    const sourceCardState = context.sourceCardState;
    if (!sourceCardState) {
        return false;
    }

    // Base abilities hard-stop if the base itself is already rested.
    if (zoneType === 'base' && sourceCardState.isRested) {
        return false;
    }

    const costConfig = (effect as unknown as { cost?: Record<string, unknown> }).cost;
    if (!costConfig || typeof costConfig !== 'object') {
        return true;
    }

    const requiresRest =
        costConfig['restSelf'] === true ||
        costConfig['rest'] === 'self' ||
        costConfig['tap'] === 'self';

    if (requiresRest && sourceCardState.isRested) {
        return false;
    }

    const energyCost = typeof costConfig['resource'] === 'number' ? (costConfig['resource'] as number) : 0;
    if (energyCost > 0 && context.availableEnergy < energyCost) {
        return false;
    }

    const oncePerTurn = costConfig['oncePerTurn'] === true;
    if (oncePerTurn && typeof effect.effectId === 'string' && effect.effectId.length > 0) {
        const usage = sourceCardState.effectUsage?.[effect.effectId];
        if (usage && usage.lastUsedTurn === context.currentTurn) {
            return false;
        }
    }

    return true;
}

function sourceConditionsAllow(
    effect: EffectDefinition,
    zoneType: ActionStepZoneType,
    context: ActionStepEffectFilterContext
): boolean {
    if (!Array.isArray(effect.sourceConditions) || effect.sourceConditions.length === 0) {
        return true;
    }

    if (zoneType === 'hand') {
        return true;
    }

    if (!context.gameEnv || !context.sourceCard || !context.sourcePlayerId) {
        return false;
    }

    return EffectSourceConditionEvaluator.sourceConditionsMet(
        effect,
        context.sourceCard,
        context.gameEnv,
        context.sourcePlayerId
    );
}
