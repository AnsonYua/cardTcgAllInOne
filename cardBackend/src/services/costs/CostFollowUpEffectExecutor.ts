import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { DeployTargetResult } from '../DeployTargetResult';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { DeployTargetManager } from '../DeployTargetManager';
import { normalizeCostPaidFollowUpEffect } from './CostFollowUpEffectNormalizer';

export function executeFollowUpEffectAfterPaidCost(
    gameEnv: GameEnvironment,
    params: {
        sourcePlayerId: string;
        sourceCarduid: string;
        followUpEffect: EffectDefinition;
        cardPlayNotificationId?: string;
        choiceContext?: Record<string, unknown>;
    }
): DeployTargetResult {
    const normalizedFollowUp = normalizeCostPaidFollowUpEffect(
        ensureEffectDefaults(params.followUpEffect)
    );

    return DeployTargetManager.processEffectWithTargetChoice(
        gameEnv,
        params.sourcePlayerId,
        params.sourceCarduid,
        normalizedFollowUp,
        params.cardPlayNotificationId,
        undefined,
        undefined,
        params.choiceContext ? { choiceContext: params.choiceContext } : undefined
    );
}
