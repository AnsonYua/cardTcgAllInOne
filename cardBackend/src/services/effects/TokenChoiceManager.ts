// src/services/effects/TokenChoiceManager.ts
// Handles choose-one token deployment effects with player choice

import { GameEnvironment } from '../../models/GameEnvironment';
import { EffectDefinition, EventStatus, TokenChoiceEvent, TokenChoiceOption } from '../EventQueue/interfaces/GameEvent';
import { ConditionalTokenDeployManager, ConditionalTokenPlan } from './ConditionalTokenDeployManager';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ExecutionResult } from '../ExecutionResult';
import { GameNotificationManager } from '../GameNotificationManager';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';

export interface TokenChoiceResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;
    autoApplied?: boolean;
}

export class TokenChoiceManager {
    static processTokenChoiceEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): TokenChoiceResult {
        const normalizedEffect = ensureEffectDefaults(effect);
        if (!ConditionalTokenDeployManager.conditionsSatisfied(normalizedEffect, gameEnv, playerId)) {
            return { success: true, autoApplied: true };
        }

        const choices = Array.isArray(normalizedEffect.parameters?.choices)
            ? (normalizedEffect.parameters!.choices as Array<Record<string, unknown>>)
            : [];

        if (choices.length === 0) {
            this.emitChoiceError(gameEnv, playerId, normalizedEffect, sourceCarduid, 'No token choices available');
            return { success: false, error: 'No token choices available for selection' };
        }

        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }

        const emptySlots = ConditionalTokenDeployManager.getEmptyUnitSlots(gameEnv, playerId);

        const availableChoices: TokenChoiceOption[] = [];
        for (let i = 0; i < choices.length; i++) {
            const choice = choices[i];
            const token = typeof choice?.token === 'object' && choice?.token ? (choice.token as Record<string, unknown>) : null;
            const count = typeof choice?.count === 'number' ? (choice.count as number) : 1;
            if (!token) {
                continue;
            }
            if (emptySlots.length < count) {
                continue;
            }

            const tokenDataResult = ConditionalTokenDeployManager.resolveTokenData(token);
            if (!tokenDataResult.success) {
                continue;
            }

            availableChoices.push({
                index: i,
                token,
                count,
                tokenData: {
                    id: tokenDataResult.tokenData.id,
                    name: tokenDataResult.tokenData.name,
                    ap: tokenDataResult.tokenData.ap,
                    hp: tokenDataResult.tokenData.hp,
                    traits: tokenDataResult.tokenData.traits
                }
            });
        }

        if (availableChoices.length === 0) {
            this.emitChoiceError(gameEnv, playerId, normalizedEffect, sourceCarduid, 'No valid token choices available');
            return { success: false, error: 'No valid token choices available for deployment' };
        }

        if (availableChoices.length === 1) {
            const planResult = this.buildPlanForChoice(gameEnv, playerId, availableChoices[0]);
            if (!planResult.success) {
                return { success: false, error: planResult.error };
            }
            const execution = ConditionalTokenDeployManager.executePlan(
                gameEnv,
                playerId,
                sourceCarduid,
                planResult.plan
            );
            return execution.success
                ? { success: true, autoApplied: true }
                : { success: false, error: execution.error };
        }

        ChoiceEventScheduler.enqueueTokenChoice(gameEnv, {
            playerId,
            sourceCarduid,
            effect: normalizedEffect,
            availableChoices,
            cardPlayNotificationId
        });
        return { success: true, requiresSelection: true };
    }

    static executeTokenChoice(event: TokenChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        if (event.status !== EventStatus.RESOLVING) {
            return { success: true };
        }

        const selectionIndex = event.data.selectedChoiceIndex;
        if (typeof selectionIndex !== 'number') {
            return { success: false, error: 'No token choice selected for effect' };
        }

        if (!ConditionalTokenDeployManager.conditionsSatisfied(event.data.effect, gameEnv, event.playerId)) {
            return { success: true };
        }

        const selectedChoice = event.data.availableChoices.find(choice => choice.index === selectionIndex);
        if (!selectedChoice) {
            return { success: false, error: 'Selected token choice not found' };
        }

        const planResult = this.buildPlanForChoice(gameEnv, event.playerId, selectedChoice);
        if (!planResult.success) {
            return { success: false, error: planResult.error };
        }

        return ConditionalTokenDeployManager.executePlan(
            gameEnv,
            event.playerId,
            event.data.sourceCarduid,
            planResult.plan
        );
    }

    private static buildPlanForChoice(
        gameEnv: GameEnvironment,
        playerId: string,
        choice: TokenChoiceOption
    ): { success: true; plan: ConditionalTokenPlan } | { success: false; error: string } {
        return ConditionalTokenDeployManager.buildPlanForTokenChoice(
            gameEnv,
            playerId,
            choice.token,
            choice.count
        );
    }

    private static emitChoiceError(
        gameEnv: GameEnvironment,
        playerId: string,
        effect: EffectDefinition,
        sourceCarduid: string,
        reason: string
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent('TOKEN_CHOICE_ERROR', {
            playerId,
            sourceCarduid,
            effectId: effect.effectId,
            action: effect.action,
            reason
        }, 'high');
    }
}
