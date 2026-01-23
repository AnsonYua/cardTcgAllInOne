// src/services/effects/PairFromTrashActivatedAbility.ts
// Handles activated abilities that pay a discardFromHand cost to execute pair_from_trash.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { TargetResolver } from '../targets/TargetResolver';
import { SequenceEffectManager } from './SequenceEffectManager';

export class PairFromTrashActivatedAbility {
    static tryExecuteWithDiscardCost(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        normalizedEffect: EffectDefinition,
        costConfig: Record<string, unknown> | undefined
    ): { handled: boolean; success: boolean; error?: string; requiresSelection?: boolean } {
        const action = typeof normalizedEffect.action === 'string' ? normalizedEffect.action : '';
        if (action !== 'pair_from_trash') {
            return { handled: false, success: true };
        }

        const discardFromHandCost = costConfig && typeof (costConfig as any).discardFromHand === 'object'
            ? ((costConfig as any).discardFromHand as Record<string, unknown>)
            : null;
        if (!discardFromHandCost) {
            return { handled: false, success: true };
        }

        const targetConfig = normalizedEffect.target;
        const costCount = typeof discardFromHandCost.count === 'number' ? discardFromHandCost.count : 1;

        const costTargetEffect: EffectDefinition = ensureEffectDefaults({
            effectId: `${normalizedEffect.effectId}_cost_discard`,
            type: 'internal',
            trigger: 'COST',
            action: 'discardFromHand',
            target: {
                type: 'card',
                scope: typeof discardFromHandCost.scope === 'string' ? discardFromHandCost.scope : 'self_hand',
                count: costCount,
                filters: {
                    ...(typeof discardFromHandCost.cardType === 'string' ? { cardType: discardFromHandCost.cardType } : {}),
                    ...(Array.isArray(discardFromHandCost.traitsAny) ? { traitsAny: discardFromHandCost.traitsAny } : {})
                },
                selection: {
                    type: 'player_choice'
                }
            }
        } as any);

        const availableCostTargets = TargetResolver.generateAvailableTargets(
            gameEnv,
            playerId,
            TargetResolver.resolveTargetConfig(costTargetEffect)
        );

        if (availableCostTargets.length < costCount) {
            return { handled: true, success: false, error: 'Not enough valid cards in hand to pay discard cost' };
        }

        const mainTargetCount = typeof targetConfig?.count === 'number' ? targetConfig.count : 1;
        if (mainTargetCount > 0) {
            const availableMainTargets = TargetResolver.generateAvailableTargets(
                gameEnv,
                playerId,
                TargetResolver.resolveTargetConfig(normalizedEffect)
            );
            if (availableMainTargets.length < mainTargetCount) {
                return { handled: true, success: false, error: 'No valid targets to resolve this ability' };
            }
        }

        const sequenceEffect: EffectDefinition = ensureEffectDefaults({
            effectId: normalizedEffect.effectId,
            type: 'activated',
            trigger: normalizedEffect.trigger,
            action: 'sequence',
            parameters: {
                version: 1,
                steps: [
                    {
                        action: 'discardFromHand',
                        target: costTargetEffect.target,
                        parameters: { value: costCount }
                    },
                    {
                        action: action,
                        target: normalizedEffect.target as any,
                        parameters: normalizedEffect.parameters as any
                    }
                ]
            }
        } as any);

        const seqResult = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            playerId,
            sourceCarduid,
            sequenceEffect
        );

        return {
            handled: true,
            success: seqResult.success,
            error: seqResult.error,
            ...(seqResult.requiresSelection ? { requiresSelection: true } : {})
        };
    }
}

