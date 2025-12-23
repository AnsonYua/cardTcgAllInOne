// src/services/GameEngine.ts
// Game execution engine - handles all game state modifications

import { GameEvent, AcknowledgeEventsEvent, PlayCardEvent,
     DeployEffectEvent, TargetChoiceEvent, PairingEffectEvent, ShieldCardAttackedEvent,
     ConfirmRedrawEvent, GameplayBeginsEvent, ErrorOccurredEvent, BurstEffectChoiceEvent,
     StartGameEvent, JoinGameEvent, NextPlayerTurnEvent, EndTurnEvent, PlayerActionEvent, RepairEffectEvent, BlockerChoiceEvent } from './EventQueue/interfaces/GameEvent';
import { GameEnvironment } from '../models/GameEnvironment';
import { EventType } from '../models/GameEnums';
import { GameNotificationManager } from './GameNotificationManager';
import { DeployEffectManager } from './DeployEffectManager';
import { PairingEffectManager } from './PairingEffectManager';
import { DeployTargetManager } from './DeployTargetManager';
import { PhaseTransitionManager } from './effects/PhaseTransitionManager';
import { RepairEffectManager } from './effects/RepairEffectManager';
import { BlockerChoiceManager } from './BlockerChoiceManager';
import { BurstEffectManager } from './BurstEffectManager';
import { ExecutionResult } from './ExecutionResult';
import { GameSetupManager } from './GameSetupManager';
import { CardPlayExecutor } from './CardPlayExecutor';
import { TurnManager } from './TurnManager';
import { PlayerActionExecutor } from './PlayerActionExecutor';

export class GameEngine {
    // ============ MAIN EXECUTION INTERFACE ============

    /**
     * Get or create notification manager for this game (static version)
     */
    private static getNotificationManager(gameEnv: GameEnvironment): GameNotificationManager {
        return new GameNotificationManager(gameEnv);
    }

    static execute(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🔥 Executing event: ${event.type}`);

        try {
            switch (event.type) {
                case EventType.CREATE_GAME:
                    return GameSetupManager.handleCreateGame(event as StartGameEvent, gameEnv);

                case EventType.JOIN_GAME:
                    return GameSetupManager.handleJoinGame(event as JoinGameEvent, gameEnv);

                case EventType.CONFIRM_REDRAW:
                    return GameSetupManager.handleConfirmRedraw(event as ConfirmRedrawEvent, gameEnv);

                case EventType.GAMEPLAY_BEGINS:
                    return GameSetupManager.handleGameplayBegins(event as GameplayBeginsEvent, gameEnv);

                case EventType.ERROR_OCCURRED:
                    return GameEngine.executeErrorEvent(event as ErrorOccurredEvent, gameEnv);

                case EventType.ACKNOWLEDGE_EVENTS:
                    return GameEngine.executeAcknowledgeEvents(event as AcknowledgeEventsEvent, gameEnv);

                case EventType.PHASE_ADVANCE:
                    return PhaseTransitionManager.executePhaseAdvance(event, gameEnv);

                case EventType.END_TURN:
                    return TurnManager.handleEndTurn(event as EndTurnEvent, gameEnv);

                case EventType.NEXT_PLAYER_TURN:
                    return TurnManager.handleNextPlayerTurn(event as NextPlayerTurnEvent, gameEnv);

                case EventType.PLAY_CARD:
                    return CardPlayExecutor.execute(event as PlayCardEvent, gameEnv);

                case EventType.PLAYER_ACTION:
                    return PlayerActionExecutor.execute(event as PlayerActionEvent, gameEnv);

                case EventType.SHIELD_CARD_ATTACKED:
                    return BurstEffectManager.processShieldCardAttack(event as ShieldCardAttackedEvent, gameEnv);

                case EventType.BURST_EFFECT_CHOICE:
                    return BurstEffectManager.processBurstEffectChoice(event as BurstEffectChoiceEvent, gameEnv);

                case EventType.DEPLOY_EFFECT_TRIGGERED:
                    return DeployEffectManager.executeDeployEffect(event as DeployEffectEvent, gameEnv);

                case EventType.TARGET_CHOICE:
                    return DeployTargetManager.executeTargetChoice(event as TargetChoiceEvent, gameEnv);

                case EventType.BLOCKER_CHOICE:
                    return BlockerChoiceManager.executeBlockerChoice(event as BlockerChoiceEvent, gameEnv);

                case EventType.PAIRING_EFFECT_TRIGGERED:
                    return GameEngine.executePairingEffect(event as PairingEffectEvent, gameEnv);

                case EventType.TRIGGER_HEALING:
                    return GameEngine.executeHealingEffect(event as RepairEffectEvent, gameEnv);

                default:
                    console.log(`🎯 Processing ${event.type} event - delegating to existing game logic`);
                    return { success: true };
            }
        } catch (error) {
            console.error(`❌ Error executing event ${event.type}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown execution error'
            };
        }
    }

    // ============ EVENT-SPECIFIC EXECUTION METHODS ============
    private static executeErrorEvent(event: ErrorOccurredEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`💥 Processing error: ${event.data.errorType} - ${event.data.errorReason}`);

        try {

            console.log(`📨 Error event added: ${event.data.errorReason}`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeErrorEvent:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'ERROR_OCCURRED execution failed'
            };
        }
    }

    private static executeAcknowledgeEvents(event: AcknowledgeEventsEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing ACKNOWLEDGE_EVENTS for ${event.data.eventIds.length} events`);

        try {
            const acknowledgedCount = GameEngine.getNotificationManager(gameEnv)
                .acknowledgeEvents(event.data.eventIds);

            event.data.acknowledgedCount = acknowledgedCount;
            console.log(`✅ ACKNOWLEDGE_EVENTS processed - ${acknowledgedCount} events acknowledged`);
            return { success: true, acknowledgedCount };

        } catch (error) {
            console.error(`❌ Error in executeAcknowledgeEvents:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'ACKNOWLEDGE_EVENTS execution failed'
            };
        }
    }

    private static executeBurstEffectChoice(event: BurstEffectChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        return BurstEffectManager.processBurstEffectChoice(event, gameEnv);
    }

    /**
     * Execute Pairing effect triggered by unit+pilot pairing
     */
    private static executePairingEffect(event: PairingEffectEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🤝 Executing PAIRING_EFFECT_TRIGGERED event: ${event.id}`);

        try {
            // Use PairingEffectManager to process the pairing effects
            const result = PairingEffectManager.processPairingEffect(gameEnv, event.playerId, event.data);

            if (!result.success) {
                console.log(`❌ Pairing effect processing failed: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }

            console.log(`✅ Pairing effects processed successfully: ${result.message}`);
            return {
                success: true
            };

        } catch (error) {
            console.error(`❌ Error in executePairingEffect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing effect execution failed'
            };
        }
    }


    /**
     * Execute healing effects directly using RepairEffectManager
     */
    public static executeHealingEffect(event: RepairEffectEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🩹 Executing healing effect: ${event.id}`);
        
        // Call RepairEffectManager directly with properly typed event
        return RepairEffectManager.executeRepairEffect(event, gameEnv);
    }

    /**
     * Find burst effects on a card that should trigger on BURST_CONDITION
     * @param cardData - The card data to search for burst effects
     * @returns Array of burst effects with BURST_CONDITION trigger
     */
    /**
     * Create a human-readable description of a burst effect
     * @param effect - The effect definition
     * @param cardData - The card data
     * @returns Human-readable description string
     */
    /**
     * Execute burst effect for confirmed choice
     * @param gameEnv - Current game environment
     * @param playerId - Player who owns the burst card
     * @param carduid - Unique ID of the burst card
     * @param cardId - Card ID for reference
     * @param cardData - Full card data
     * @param burstEffect - Burst effect configuration
     */

}
