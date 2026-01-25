// src/services/costs/MoveFromHandToDeckBottomCostFlow.ts
// Cost flow: choose a card in hand, reveal it, move it to deck bottom. Used by ATTACK_PHASE effects (e.g. ST08-006).

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { TargetResolver } from '../targets/TargetResolver';
import { TargetSelectionPipeline } from '../targets/TargetSelectionPipeline';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { EffectExecutor } from '../effects/EffectExecutor';

type MoveFromHandToDeckBottomCostConfig = {
    scope?: string;
    filters?: Record<string, unknown>;
    count?: number;
    reveal?: boolean;
};

export type MoveFromHandToDeckBottomCostContext = {
    kind: 'COST_MOVE_FROM_HAND_TO_DECK_BOTTOM_THEN_DRAW';
    sourceCarduid: string;
    sourcePlayerId: string;
    drawCount: number;
    attackEffectUsageId: string;
};

export class MoveFromHandToDeckBottomCostFlow {
    static handleOrEnqueue(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        drawCount: number,
        cardPlayNotificationId?: string
    ): { success: boolean; paid?: boolean; requiresSelection?: boolean; choiceEventId?: string; error?: string } {
        const costConfig = effect.cost && typeof effect.cost === 'object'
            ? ((effect.cost as any).moveFromHandToDeckBottom as MoveFromHandToDeckBottomCostConfig | undefined)
            : undefined;
        if (!costConfig) {
            return { success: true, paid: false };
        }

        const requiredCount = typeof costConfig.count === 'number' ? costConfig.count : 1;
        if (requiredCount <= 0) {
            return { success: true, paid: false };
        }

        const reveal = costConfig.reveal === true;

        const costEffect = ensureEffectDefaults({
            effectId: `${effect.effectId || effect.action || 'effect'}_cost_moveFromHandToDeckBottom`,
            type: 'internal',
            trigger: 'COST',
            action: 'moveFromHandToDeckBottom',
            target: {
                type: 'card',
                scope: typeof costConfig.scope === 'string' ? costConfig.scope : 'self_hand',
                count: requiredCount,
                filters: typeof costConfig.filters === 'object' && costConfig.filters ? costConfig.filters : {},
                selection: {
                    type: 'player_choice'
                }
            },
            parameters: {
                reveal
            }
        } as any);

        const targetConfig = TargetResolver.resolveTargetConfig(costEffect);
        let availableTargets = TargetResolver.generateAvailableTargets(gameEnv, playerId, targetConfig);
        availableTargets = TargetSelectionPipeline.apply(gameEnv, availableTargets, costEffect, sourceCarduid);

        if (availableTargets.length < requiredCount) {
            return { success: true, paid: false };
        }

        if (availableTargets.length === requiredCount) {
            const result = EffectExecutor.applyEffectToTargets(
                gameEnv,
                costEffect,
                availableTargets.slice(0, requiredCount),
                playerId,
                sourceCarduid
            );
            if (!result.success) {
                return { success: false, error: result.error || 'Failed to pay moveFromHandToDeckBottom cost' };
            }
            return { success: true, paid: true };
        }

        const choiceEvent: TargetChoiceEvent = ChoiceEventScheduler.enqueueTargetChoice(gameEnv, {
            playerId,
            sourceCarduid,
            effect: costEffect,
            availableTargets,
            cardPlayNotificationId
        });

        const attackEffectUsageId = effect.effectId || effect.action || 'attack_effect';

        choiceEvent.data.context = {
            kind: 'COST_MOVE_FROM_HAND_TO_DECK_BOTTOM_THEN_DRAW',
            sourceCarduid,
            sourcePlayerId: playerId,
            drawCount,
            attackEffectUsageId
        } satisfies MoveFromHandToDeckBottomCostContext;

        return { success: true, requiresSelection: true, choiceEventId: choiceEvent.id };
    }
}
