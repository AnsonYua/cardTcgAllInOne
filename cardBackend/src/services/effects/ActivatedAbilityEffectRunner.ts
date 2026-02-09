// src/services/effects/ActivatedAbilityEffectRunner.ts
// Centralized helper for executing an activated ability's effect once costs/energy/rest are handled.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { ExecutionResult } from '../ExecutionResult';
import { DeployTargetManager } from '../DeployTargetManager';
import { EffectExecutor } from './EffectExecutor';
import { ConditionalTokenDeployManager, ConditionalTokenPlan } from './ConditionalTokenDeployManager';
import { PairFromTrashActivatedAbility } from './PairFromTrashActivatedAbility';

export class ActivatedAbilityEffectRunner {
    static execute(
        gameEnv: GameEnvironment,
        params: {
            actingPlayerId: string;
            sourceCarduid: string;
            normalizedEffect: EffectDefinition;
            costConfig?: Record<string, unknown>;
            pendingTokenPlan?: ConditionalTokenPlan | null;
        }
    ): ExecutionResult & { requiresSelection?: boolean } {
        const { actingPlayerId, sourceCarduid, normalizedEffect, costConfig, pendingTokenPlan } = params;

        const pairFromTrashResult = PairFromTrashActivatedAbility.tryExecuteWithDiscardCost(
            gameEnv,
            actingPlayerId,
            sourceCarduid,
            normalizedEffect,
            costConfig
        );
        if (pairFromTrashResult.handled) {
            if (!pairFromTrashResult.success) {
                return { success: false, error: pairFromTrashResult.error || 'Pair-from-trash ability failed' };
            }
            return pairFromTrashResult.requiresSelection
                ? { success: true, requiresSelection: true }
                : { success: true };
        }

        const action = EffectExecutor.getEffectAction(normalizedEffect);
        if (action === 'conditionalTokenDeploy') {
            if (!pendingTokenPlan) {
                return { success: false, error: 'Conditional token deploy plan missing' };
            }
            return ConditionalTokenDeployManager.executePlan(gameEnv, actingPlayerId, sourceCarduid, pendingTokenPlan);
        }

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            actingPlayerId,
            sourceCarduid,
            normalizedEffect
        );

        if (!result.success) {
            return { success: false, error: result.error || 'Activated ability failed' };
        }

        return (result as any)?.requiresSelection === true
            ? { success: true, requiresSelection: true }
            : { success: true };
    }
}

