// src/services/choices/ChoiceConfirmationService.ts
// Centralized helpers for confirming choice events (TARGET_CHOICE, TOKEN_CHOICE).

import { EventType } from '../../models/GameEnums';
import { ChoiceNotificationEmitter } from '../notifications/ChoiceNotificationEmitter';
import { BattlePhaseManager } from '../BattlePhaseManager';
import { CardPlayNotificationLifecycle } from '../notifications/CardPlayNotificationLifecycle';
import type { GameEnvironment } from '../../models/GameEnvironment';
import type { GameEvent, TargetChoiceEvent, TargetReference, TokenChoiceEvent, OptionChoiceEvent, PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import type { GameLogicResult } from '../GameLogic';

export interface ChoiceConfirmationPersistence {
    loadGameFromFile(gameId: string): Promise<GameEnvironment | null>;
    saveGameToFile(gameId: string, gameEnv: GameEnvironment): Promise<void>;
}

export class ChoiceConfirmationService {
    private static async processAndPersist(
        persistence: ChoiceConfirmationPersistence,
        gameId: string,
        gameEnv: GameEnvironment,
        notificationId?: string
    ): Promise<GameLogicResult> {
        if (notificationId) {
            CardPlayNotificationLifecycle.markCompleted(gameEnv, notificationId);
        }

        const processingResult = await gameEnv.processEvents();
        if (!processingResult.success) {
            return {
                success: false,
                error: processingResult.error || 'Failed to process choice'
            };
        }

        // If we are in an ACTION_STEP battle and both players already confirmed resolution, a choice
        // (like TARGET_CHOICE for an activated ability) can finish without re-triggering the usual
        // auto-resolve hooks (confirmBattle / post-play). Re-check here so battles don't get stuck.
        if (
            gameEnv.processingQueue.length === 0 &&
            gameEnv.currentBattle?.status === 'ACTION_STEP' &&
            gameEnv.haveBothPlayersConfirmedBattle()
        ) {
            const attackerId = gameEnv.currentBattle.attackingPlayerId;
            if (attackerId) {
                const battleResult = BattlePhaseManager.resolveBattle(gameEnv, attackerId);
                if (!battleResult.success) {
                    return {
                        success: false,
                        error: battleResult.error || 'Failed to auto-resolve battle after choice'
                    };
                }

                const postBattleProcessing = await gameEnv.processEvents();
                if (!postBattleProcessing.success) {
                    return {
                        success: false,
                        error: postBattleProcessing.error || 'Failed to process events after battle resolution'
                    };
                }
            }
        }

        await persistence.saveGameToFile(gameId, gameEnv);
        return { success: true, gameId, gameEnv };
    }

    static async confirmTargetChoice(
        persistence: ChoiceConfirmationPersistence,
        gameId: string,
        playerId: string,
        eventId: string,
        selectedTargets: TargetReference[]
    ): Promise<GameLogicResult> {
        try {
            const gameEnv = await persistence.loadGameFromFile(gameId);
            if (!gameEnv) {
                return { success: false, error: 'Game not found' };
            }

            const event = gameEnv.processingQueue.find(e => e.id === eventId) as TargetChoiceEvent | undefined;
            if (!event) {
                return { success: false, error: 'Target choice event not found' };
            }

            if (event.type !== EventType.TARGET_CHOICE) {
                return { success: false, error: 'Event is not a target choice' };
            }

            if (event.playerId !== playerId) {
                return { success: false, error: 'Player is not authorized to resolve this event' };
            }

            const isOptional = event.data.effect?.optional === true;
            const isCostChoice = event.data.effect?.trigger === 'COST';
            const requiredCount = typeof event.data.effect?.target?.count === 'number'
                ? event.data.effect.target.count
                : undefined;

            if (selectedTargets.length === 0 && !isOptional) {
                return { success: false, error: 'No targets selected for effect' };
            }

            if (typeof requiredCount === 'number' && requiredCount > 0) {
                // For COST choices, selection must match the exact required count when paying the cost.
                // Optional costs can be declined by selecting nothing.
                if (isCostChoice) {
                    const isDecline = selectedTargets.length === 0 && isOptional;
                    if (!isDecline && selectedTargets.length !== requiredCount) {
                        return {
                            success: false,
                            error: `This cost requires selecting exactly ${requiredCount} target(s)`
                        };
                    }
                }
            }

            if (selectedTargets.length > 0) {
                const availableTargets = event.data.availableTargets || [];
                for (const selectedTarget of selectedTargets) {
                    const isValidTarget = availableTargets.some((target: any) =>
                        target.carduid === selectedTarget.carduid &&
                        target.zone === selectedTarget.zone &&
                        target.playerId === selectedTarget.playerId
                    );
                    if (!isValidTarget) {
                        return {
                            success: false,
                            error: `Selected target ${selectedTarget.carduid} in ${selectedTarget.zone} is not in available targets list`
                        };
                    }
                }
            }

            event.data.selectedTargets = selectedTargets;
            event.data.userDecisionMade = true;
            ChoiceNotificationEmitter.emitTargetChoiceResolved(gameEnv, event);

            return await this.processAndPersist(
                persistence,
                gameId,
                gameEnv,
                event.data.cardPlayNotificationId
            );
        } catch (error) {
            return {
                success: false,
                error: `Failed to confirm target choice: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    static async confirmTokenChoice(
        persistence: ChoiceConfirmationPersistence,
        gameId: string,
        playerId: string,
        eventId: string,
        selectedChoiceIndex: number
    ): Promise<GameLogicResult> {
        try {
            const gameEnv = await persistence.loadGameFromFile(gameId);
            if (!gameEnv) {
                return { success: false, error: 'Game not found' };
            }

            const event = gameEnv.processingQueue.find(e => e.id === eventId) as TokenChoiceEvent | undefined;
            if (!event) {
                return { success: false, error: 'Token choice event not found' };
            }

            if (event.type !== EventType.TOKEN_CHOICE) {
                return { success: false, error: 'Event is not a token choice' };
            }

            if (event.playerId !== playerId) {
                return { success: false, error: 'Player is not authorized to resolve this event' };
            }

            const availableChoices = event.data.availableChoices || [];
            const selectedChoice = availableChoices.find((choice: any) => choice.index === selectedChoiceIndex);
            if (!selectedChoice) {
                return { success: false, error: 'Selected token choice is not available' };
            }

            event.data.selectedChoiceIndex = selectedChoiceIndex;
            event.data.userDecisionMade = true;
            ChoiceNotificationEmitter.emitTokenChoiceResolved(gameEnv, event);

            return await this.processAndPersist(
                persistence,
                gameId,
                gameEnv,
                event.data.cardPlayNotificationId
            );
        } catch (error) {
            return {
                success: false,
                error: `Failed to confirm token choice: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    static async confirmOptionChoice(
        persistence: ChoiceConfirmationPersistence,
        gameId: string,
        playerId: string,
        eventId: string,
        selectedOptionIndex: number
    ): Promise<GameLogicResult> {
        try {
            const gameEnv = await persistence.loadGameFromFile(gameId);
            if (!gameEnv) {
                return { success: false, error: 'Game not found' };
            }

            const event = gameEnv.processingQueue.find(e => e.id === eventId) as GameEvent | undefined;
            if (!event) {
                return { success: false, error: 'Option choice event not found' };
            }

            if (event.playerId !== playerId) {
                return { success: false, error: 'Player is not authorized to resolve this event' };
            }

            let cardPlayNotificationId: string | undefined;
            if (event.type === EventType.OPTION_CHOICE) {
                const optionEvent = event as OptionChoiceEvent;
                const availableOptions = optionEvent.data.availableOptions || [];
                const selectedOption = availableOptions.find(opt => opt.index === selectedOptionIndex);
                if (!selectedOption) {
                    return { success: false, error: 'Selected option is not available' };
                }

                optionEvent.data.selectedOptionIndex = selectedOptionIndex;
                optionEvent.data.userDecisionMade = true;
                ChoiceNotificationEmitter.emitOptionChoiceResolved(gameEnv, optionEvent);
                cardPlayNotificationId = optionEvent.data.cardPlayNotificationId;
            } else if (event.type === EventType.PROMPT_CHOICE) {
                const promptEvent = event as PromptChoiceEvent;
                const availableOptions = promptEvent.data.availableOptions || [];
                const selectedOption = availableOptions.find(opt => opt.index === selectedOptionIndex);
                if (!selectedOption) {
                    return { success: false, error: 'Selected option is not available' };
                }

                promptEvent.data.selectedOptionIndex = selectedOptionIndex;
                promptEvent.data.userDecisionMade = true;
                ChoiceNotificationEmitter.emitPromptChoiceResolved(gameEnv, promptEvent);
                cardPlayNotificationId = promptEvent.data.cardPlayNotificationId;
            } else {
                return { success: false, error: 'Event is not an option choice' };
            }

            return await this.processAndPersist(
                persistence,
                gameId,
                gameEnv,
                cardPlayNotificationId
            );
        } catch (error) {
            return {
                success: false,
                error: `Failed to confirm option choice: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
