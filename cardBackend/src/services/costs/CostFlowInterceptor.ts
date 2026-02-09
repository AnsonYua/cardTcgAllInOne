// src/services/costs/CostFlowInterceptor.ts
// Centralizes "pre-effect" cost flows that must be paid before resolving an effect.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { DeployTargetResult } from '../DeployTargetResult';
import { ExileFromTrashCostFlow } from './ExileFromTrashCostFlow';

export class CostFlowInterceptor {
    static intercept(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): DeployTargetResult | null {
        const noOp: DeployTargetResult = { success: true, autoApplied: true, affectedTargets: [] };

        if (effect.cost && typeof effect.cost === 'object' && (effect.cost as any).exileFromTrash) {
            const costResult = ExileFromTrashCostFlow.handleOrEnqueue(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            );
            if (!costResult.success) {
                return { success: false, error: costResult.error || 'Failed to enqueue exileFromTrash cost choice' };
            }
            if (costResult.kind === 'requiresSelection') {
                return { success: true, requiresSelection: true, choiceEventId: costResult.choiceEventId };
            }
            if (costResult.kind === 'paid') {
                // Cost was paid immediately; continue resolving the follow-up effect in the current call.
                return null;
            }
            if (costResult.kind === 'insufficientTargets') {
                // Not enough targets to pay cost:
                // - Activated abilities should fail to activate.
                // - Triggered/continuous effects can soft-fail (no-op) to avoid hard-stopping processing.
                if (effect.type === 'activated') {
                    return { success: false, error: 'Not enough valid cards in trash to pay exileFromTrash cost' };
                }
                return noOp;
            }
            return noOp;
        }

        return null;
    }
}
