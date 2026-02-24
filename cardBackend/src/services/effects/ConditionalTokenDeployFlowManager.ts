import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { DeployTargetResult } from '../DeployTargetResult';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ConditionalTokenDeployManager } from './ConditionalTokenDeployManager';

export class ConditionalTokenDeployFlowManager {
    static processEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): DeployTargetResult {
        const normalizedEffect = ensureEffectDefaults(effect);
        if (!ConditionalTokenDeployManager.conditionsSatisfied(normalizedEffect, gameEnv, playerId)) {
            return { success: true, autoApplied: true, affectedTargets: [] };
        }

        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }

        const configResult = ConditionalTokenDeployManager.resolveMatchingConditionConfig(gameEnv, playerId, normalizedEffect);
        if (!configResult.success) {
            if (configResult.error === 'No matching token condition found for board state') {
                return { success: true, autoApplied: true, affectedTargets: [] };
            }
            return { success: false, error: configResult.error };
        }

        const emptySlots = SlotZoneUtils.getEmptySlotNames(player.zones);
        const requiredCount = Math.max(0, configResult.config.count);
        const shortage = Math.max(0, requiredCount - emptySlots.length);

        if (shortage > 0) {
            const availableTargets: TargetReference[] = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId).map((entry: any) => ({
                carduid: entry.unit.carduid,
                zone: entry.slotName,
                playerId,
                cardData: entry.unit.cardData
            }));

            const choiceEffect = ensureEffectDefaults({
                effectId: normalizedEffect.effectId || 'conditional_token_deploy',
                type: 'internal',
                trigger: 'SEQUENCE_STEP',
                optional: false,
                action: 'conditionalTokenDeploy',
                target: {
                    type: 'unit',
                    scope: 'self',
                    count: shortage,
                    selection: { type: 'player_choice' }
                },
                parameters: normalizedEffect.parameters
            } as any);

            const choiceEvent = ChoiceEventScheduler.enqueueTargetChoice(gameEnv, {
                playerId,
                sourceCarduid,
                effect: choiceEffect,
                availableTargets,
                cardPlayNotificationId
            });

            return {
                success: true,
                requiresSelection: true,
                choiceEventId: choiceEvent.id
            };
        }

        const planResult = ConditionalTokenDeployManager.buildPlan(gameEnv, playerId, normalizedEffect);
        if (!planResult.success) {
            if (planResult.error === 'No matching token condition found for board state') {
                return { success: true, autoApplied: true, affectedTargets: [] };
            }
            return { success: false, error: planResult.error };
        }

        const execution = ConditionalTokenDeployManager.executePlan(
            gameEnv,
            playerId,
            sourceCarduid,
            planResult.plan
        );
        if (!execution.success) {
            return { success: false, error: execution.error };
        }

        return { success: true, autoApplied: true, affectedTargets: [] };
    }
}
