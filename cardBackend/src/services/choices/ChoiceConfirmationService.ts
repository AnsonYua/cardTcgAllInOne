// src/services/choices/ChoiceConfirmationService.ts
// Centralized helpers for confirming choice events (TARGET_CHOICE, TOKEN_CHOICE).

import { EventType } from '../../models/GameEnums';
import { GameNotificationManager } from '../GameNotificationManager';
import { ChoiceNotificationEmitter } from '../notifications/ChoiceNotificationEmitter';
import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference, TokenChoiceEvent } from '../EventQueue/interfaces/GameEvent';
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
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.updateNotificationEvent(notificationId, { isCompleted: true });
        }

        const processingResult = await gameEnv.processEvents();
        if (!processingResult.success) {
            return {
                success: false,
                error: processingResult.error || 'Failed to process choice'
            };
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
            if (selectedTargets.length === 0 && !isOptional) {
                return { success: false, error: 'No targets selected for effect' };
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
}
