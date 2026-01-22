// src/services/effects/actions/EffectSequenceActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { EffectExecutor } from '../EffectExecutor';
import { applyMoveTopDeckToTrash } from './EffectDeckActions';

interface SequenceStep {
    action: string;
    parameters?: Record<string, unknown>;
}

interface SequenceContext {
    movedCards: any[];
}

export function applySequenceEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    const steps = Array.isArray(effect.parameters?.steps)
        ? (effect.parameters!.steps as SequenceStep[])
        : [];

    if (steps.length === 0) {
        return { success: true };
    }

    const ctx: SequenceContext = { movedCards: [] };

    for (const step of steps) {
        if (!step || typeof step.action !== 'string') {
            continue;
        }

        const stepAction = step.action;
        const params = (step.parameters || {}) as Record<string, unknown>;

        if (stepAction === 'moveTopDeckToTrash') {
            const count = typeof params.count === 'number' ? params.count : 0;
            if (count > 0) {
                const result = applyMoveTopDeckToTrash(gameEnv, sourcePlayerId, count);
                if (!result.success) {
                    return { success: false, error: result.error || 'moveTopDeckToTrash failed' };
                }
                ctx.movedCards = result.movedCards;
            }
            continue;
        }

        if (stepAction === 'draw_if_moved_cards_match_traits') {
            const traitsAny = Array.isArray(params.traitsAny)
                ? params.traitsAny.filter(item => typeof item === 'string')
                : [];
            const value = typeof params.value === 'number' ? params.value : 0;

            const matched = traitsAny.length === 0
                ? ctx.movedCards.length > 0
                : ctx.movedCards.some((card: any) => {
                    const cardTraits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
                    return traitsAny.some((trait: string) => cardTraits.includes(trait));
                });

            if (matched && value > 0) {
                const player = gameEnv.getPlayer(sourcePlayerId);
                if (!player?.deck) {
                    return { success: false, error: 'Player deck not found for conditional draw' };
                }
                EffectExecutor.drawCardsIntoHand(gameEnv, sourcePlayerId, player.deck as any, value, {
                    drawContext: sourceCarduid ? `sequence:${sourceCarduid}` : 'sequence'
                });
            }
            continue;
        }

        return { success: false, error: `Unsupported sequence step action: ${stepAction}` };
    }

    return { success: true };
}

