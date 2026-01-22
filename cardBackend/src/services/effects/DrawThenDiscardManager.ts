// src/services/effects/DrawThenDiscardManager.ts
// Handles "draw N, then discard M" effects that require sequencing.

import { GameEnvironment } from '../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from './EffectExecutor';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';

export interface DrawThenDiscardResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;
    autoApplied?: boolean;
}

export class DrawThenDiscardManager {
    static processDrawThenDiscardEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): DrawThenDiscardResult {
        const normalizedEffect = ensureEffectDefaults(effect);
        const drawCount = typeof normalizedEffect.parameters?.draw === 'number' ? normalizedEffect.parameters.draw : 0;
        const discardCount = typeof normalizedEffect.parameters?.discard === 'number' ? normalizedEffect.parameters.discard : 0;

        const player = gameEnv.getPlayer(playerId);
        if (!player?.deck) {
            return { success: false, error: 'Player deck not found for draw_then_discard' };
        }

        if (drawCount > 0) {
            EffectExecutor.drawCardsIntoHand(gameEnv, playerId, player.deck as any, drawCount, {
                drawContext: sourceCarduid ? `draw_then_discard:${sourceCarduid}` : 'draw_then_discard'
            });
        }

        if (discardCount <= 0) {
            return { success: true, autoApplied: true };
        }

        const handCards = player.deck.hand || [];
        if (handCards.length === 0) {
            return { success: true, autoApplied: true };
        }

        const availableTargets: TargetReference[] = handCards.map((card: any) => ({
            carduid: card.carduid,
            zone: 'hand',
            playerId,
            cardData: card.cardData
        }));

        const discardEffect: EffectDefinition = ensureEffectDefaults({
            effectId: `${normalizedEffect.effectId || 'draw_then_discard'}_discard`,
            type: 'internal',
            trigger: 'CHOICE_RESOLUTION',
            action: 'discardFromHand',
            target: {
                type: 'card',
                scope: 'self_hand',
                count: Math.min(discardCount, availableTargets.length)
            }
        } as any);

        ChoiceEventScheduler.enqueueTargetChoice(gameEnv, {
            playerId,
            sourceCarduid,
            effect: discardEffect,
            availableTargets,
            cardPlayNotificationId
        });

        return { success: true, requiresSelection: true };
    }
}
