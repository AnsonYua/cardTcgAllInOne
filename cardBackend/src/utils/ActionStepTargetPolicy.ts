import { ActionStepTargetSummary } from '../models/BattleContext';
import { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';
import { isPlayOrActivatedEffect } from './EffectTypeRouter';

export type ActionStepZoneType = ActionStepTargetSummary['zoneType'];

export function extractActionStepEffectIds(effects: EffectDefinition[], zoneType: ActionStepZoneType): string[] {
    const actionEffectIds: string[] = [];

    for (const effect of effects) {
        if (effectSupportsActionStep(effect, zoneType)) {
            actionEffectIds.push(effect.effectId || effect.action || 'action_step_effect');
        }
    }

    return actionEffectIds;
}

function effectSupportsActionStep(effect: EffectDefinition, zoneType: ActionStepZoneType): boolean {
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

