// src/services/effects/PhaseTransitionManager.ts
// Dedicated manager for phase transition detection and execution

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase, EventType } from '../../models/GameEnums';
import { GameEvent, NextPlayerTurnEvent, EndTurnEvent, StartGameEvent, JoinGameEvent, GameplayBeginsEvent } from '../EventQueue/interfaces/GameEvent';
import { StateBasedAction } from '../EventQueue/StateBasedActionEngine';
import { TurnLifecycleManager } from '../TurnLifecycleManager';
import { GameSetupManager } from '../GameSetupManager';
import { EnergyManager } from '../EnergyManager';
import { ShieldCardManager } from '../ShieldCardManager';
import { BaseCardManager } from '../BaseCardManager';
import { PlayerCardManager } from '../PlayerCardManager';

interface ExecutionResult {
    success: boolean;
    error?: string;
}

export class PhaseTransitionManager {

    // ============ DETECTION METHODS ============

    /**
     * Check for GAMEPLAY_BEGINS conditions (both players ready and confirmed)
     */
    static checkGameStartConditions(gameEnv: GameEnvironment): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // Only check if we're in REDRAW_PHASE and haven't started yet
        if (gameEnv.phase !== GamePhase.REDRAW_PHASE) {
            return actions;
        }

        if (gameEnv.pendingPhaseTransition === EventType.GAMEPLAY_BEGINS) {
            return actions;
        }
        
        // Ensure both players exist
        if (!gameEnv.playerId_1 || !gameEnv.playerId_2) {
            return actions;
        }
        
        // Check if both players are ready and confirmed
        const bothPlayersReady = gameEnv.playersReady[gameEnv.playerId_1] && 
                                gameEnv.playersReady[gameEnv.playerId_2];
        
        const player1 = gameEnv.players[gameEnv.playerId_1];
        const player2 = gameEnv.players[gameEnv.playerId_2];
        const bothPlayersConfirmed = player1?.confirmIsRedraw == true && 
                                    player2?.confirmIsRedraw == true;
        
        console.log(`🔍 GAMEPLAY_BEGINS check: bothReady=${bothPlayersReady}, bothConfirmed=${bothPlayersConfirmed}, phase=${gameEnv.phase}`);
        
        if (bothPlayersReady && bothPlayersConfirmed) {
            console.log(`🎯 State-based action detected: GAMEPLAY_BEGINS conditions met`);
            gameEnv.pendingPhaseTransition = EventType.GAMEPLAY_BEGINS;
            actions.push({
                actionId: `game_start_${Date.now()}`,
                type: EventType.GAMEPLAY_BEGINS,
                autoExecute: true
            });
        }
        
        return actions;
    }

    /**
     * Check for DRAW_PHASE to MAIN_PHASE transition
     */
    static checkDrawPhaseToMainPhase(gameEnv: GameEnvironment): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // Only check if we're in DRAW_PHASE
        if (gameEnv.phase !== GamePhase.DRAW_PHASE) {
            return actions;
        }

        if (gameEnv.pendingPhaseTransition === EventType.PHASE_ADVANCE) {
            return actions;
        }
        
        // Check if there are no unacknowledged card draw events in the notification queue
        const notificationQueue = gameEnv.notificationQueue || [];
        const hasUnacknowledgedCardDrawEvent = notificationQueue.some(event => 
            event.type === 'CARD_DRAWN' &&
            event.metadata?.frontendProcessed === false
        );
        
        console.log(`🔍 DRAW_PHASE check: phase=${gameEnv.phase}, hasUnacknowledgedCardDrawEvent=${hasUnacknowledgedCardDrawEvent}`);
        
        if (!hasUnacknowledgedCardDrawEvent) {
            console.log(`🎯 State-based action detected: DRAW_PHASE to MAIN_PHASE transition needed`);
            gameEnv.pendingPhaseTransition = EventType.PHASE_ADVANCE;
            actions.push({
                actionId: `draw_to_main_${Date.now()}`,
                type: EventType.PHASE_ADVANCE,
                autoExecute: true
            });
        }
        
        return actions;
    }

    /**
     * Check END_PHASE to next player transition (excluding repair abilities - handled by RepairEffectManager)
     */
    static checkEndPhaseToNextPlayer(gameEnv: GameEnvironment): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // Check if we're in END_PHASE and need to transition to next player
        if (gameEnv.phase === GamePhase.END_PHASE) {
            console.log(`🔄 END_PHASE detected - checking for next player transition`);

            if (gameEnv.pendingPhaseTransition === EventType.NEXT_PLAYER_TURN) {
                return actions;
            }
            
            // Calculate next player
            const nextPlayerId = gameEnv.currentPlayer === gameEnv.playerId_1 
                ? gameEnv.playerId_2 
                : gameEnv.playerId_1;
            
            if (nextPlayerId) {
                console.log(`🎯 State-based action detected: END_PHASE to next player transition (${gameEnv.currentPlayer} → ${nextPlayerId})`);
                gameEnv.pendingPhaseTransition = EventType.NEXT_PLAYER_TURN;
                actions.push({
                    actionId: `end_phase_next_player_${Date.now()}`,
                    type: EventType.NEXT_PLAYER_TURN,
                    autoExecute: true,
                    data: {
                        nextPlayer: nextPlayerId
                    }
                });
            }
        }
        
        return actions;
    }

    // ============ EXECUTION METHODS ============

    static executeCreateGame(event: StartGameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing CREATE_GAME event for player: ${event.data.playerId}`);

        try {
            gameEnv.playerId_1 = event.data.playerId;
            gameEnv.updatePhase(GamePhase.WAITING_FOR_PLAYERS, event.data.playerId);
            gameEnv.gameStarted = false;
            gameEnv.playersReady = gameEnv.playersReady || {};
            gameEnv.playersReady[event.data.playerId] = true;

            console.log(`✅ CREATE_GAME event processed - game state initialized for ${event.data.playerId}`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error in executeCreateGame:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'CREATE_GAME execution failed'
            };
        }
    }

    static executeJoinGame(event: JoinGameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing JOIN_GAME event for player: ${event.data.playerId}`);

        try {
            gameEnv.playerId_2 = event.data.playerId;
            gameEnv.updatePhase(GamePhase.REDRAW_PHASE, event.data.playerId);
            gameEnv.gameStarted = true;
            gameEnv.playersReady[event.data.playerId] = true;

            GameSetupManager.initializeGameWithDecks(gameEnv);

            console.log(`✅ JOIN_GAME event processed - second player ${event.data.playerId} added`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error in executeJoinGame:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'JOIN_GAME execution failed'
            };
        }
    }

    /**
     * Execute GAMEPLAY_BEGINS event
     */
    static executeGameplayBegins(event: GameplayBeginsEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { description } = event.data;
        console.log(`🎯 Processing GAME_START state-based action: ${description}`);

        try {
            gameEnv.pendingPhaseTransition = null;
            const firstPlayerId = gameEnv.firstPlayer === 0 ? gameEnv.playerId_1! : gameEnv.playerId_2!;
            const secondPlayerId = gameEnv.firstPlayer === 0 ? gameEnv.playerId_2! : gameEnv.playerId_1!;

            EnergyManager.addExtraEnergy(gameEnv, secondPlayerId);
            EnergyManager.addBasicEnergy(gameEnv, firstPlayerId);

            ShieldCardManager.createShieldCardsFromDeck(gameEnv, firstPlayerId);
            ShieldCardManager.createShieldCardsFromDeck(gameEnv, secondPlayerId);

            BaseCardManager.createBaseCardsFromDeck(gameEnv, firstPlayerId);
            BaseCardManager.createBaseCardsFromDeck(gameEnv, secondPlayerId);

            gameEnv.currentPlayer = firstPlayerId;
            gameEnv.updatePhase(GamePhase.DRAW_PHASE, firstPlayerId);
            console.log(`📋 Advanced to DRAW_PHASE for first player turn`);

            const firstPlayer = gameEnv.players[firstPlayerId];
            if (firstPlayer?.deck) {
                PlayerCardManager.drawCards(gameEnv, firstPlayerId, 1);
                console.log(`🃏 Drew 1 card for first player ${firstPlayerId}`);
            }

            console.log(`✅ GAMEPLAY_BEGINS event processed - resources allocated, first player set, card drawn`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error executing GAMEPLAY_BEGINS:`, error);
            gameEnv.pendingPhaseTransition = null;
            return {
                success: false,
                error: error instanceof Error ? error.message : 'GAMEPLAY_BEGINS execution failed'
            };
        }
    }

    static executePhaseAdvance(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Executing PHASE_ADVANCE event: ${event.id}`);

        try {
            gameEnv.pendingPhaseTransition = null;
            const currentPhase = gameEnv.phase;

            // Advance from DRAW_PHASE to MAIN_PHASE when appropriate
            if (currentPhase === GamePhase.DRAW_PHASE) {
                gameEnv.updatePhase(GamePhase.MAIN_PHASE);
                console.log(`✅ Phase advanced: ${currentPhase} → ${gameEnv.phase}`);

                console.log(`📨 Phase change notification enqueued`);
            } else {
                console.log(`⚠️ PHASE_ADVANCE called from unexpected phase: ${currentPhase}`);
            }

            return { success: true };

        } catch (error) {
            console.error(`❌ Error executing PHASE_ADVANCE:`, error);
            gameEnv.pendingPhaseTransition = null;
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Phase advance execution failed'
            };
        }
    }

    /**
     * Execute END_TURN event (enters END_PHASE and queues SBA transitions)
     */
    static executeEndTurn(event: EndTurnEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, currentTurnNumber } = event.data;
        const fromBurst = event.data.fromBurst || false;

        console.log(`🏁 Processing END_TURN event for player: ${playerId}, turn: ${currentTurnNumber}, fromBurst: ${fromBurst}`);

        try {
            if (gameEnv.currentPlayer !== playerId) {
                return {
                    success: false,
                    error: `Not your turn. Current player: ${gameEnv.currentPlayer}`
                };
            }

            TurnLifecycleManager.cleanupEndTurn(gameEnv, playerId);

            gameEnv.updatePhase(GamePhase.END_PHASE, playerId);
            console.log(`🏁 Phase set to END_PHASE - state-based actions will handle next player transition`);

            return { success: true };
        } catch (error) {
            console.error(`❌ Error in executeEndTurn:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'END_TURN execution failed'
            };
        }
    }

    /**
     * Execute NEXT_PLAYER_TURN event
     */
    static executeNextPlayerTurn(event: NextPlayerTurnEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Executing NEXT_PLAYER_TURN event: ${event.id}`);
        
        try {
            gameEnv.pendingPhaseTransition = null;
            const nextPlayer = event.data?.nextPlayer;
            if (!nextPlayer) {
                return {
                    success: false,
                    error: 'No nextPlayer specified in NEXT_PLAYER_TURN event'
                };
            }

            // Update current player
            const previousPlayer = gameEnv.currentPlayer;
            gameEnv.currentPlayer = nextPlayer;

            // Increment turn counter
            gameEnv.currentTurn = (gameEnv.currentTurn || 0) + 1;

            // Start new turn in DRAW_PHASE
            gameEnv.updatePhase(GamePhase.DRAW_PHASE, nextPlayer);
            TurnLifecycleManager.startTurn(gameEnv, nextPlayer);

            console.log(`✅ Player turn advanced: ${previousPlayer} → ${nextPlayer} (turn ${gameEnv.currentTurn})`);
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error executing NEXT_PLAYER_TURN:`, error);
            gameEnv.pendingPhaseTransition = null;
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Next player turn execution failed'
            };
        }
    }

    // ============ UTILITY METHODS ============

    /**
     * Get all phase transition actions for a game environment
     */
    static getAllPhaseTransitionActions(gameEnv: GameEnvironment): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        actions.push(...this.checkGameStartConditions(gameEnv));
        actions.push(...this.checkDrawPhaseToMainPhase(gameEnv));
        actions.push(...this.checkEndPhaseToNextPlayer(gameEnv));
        
        return actions;
    }

    // executePhaseTransition removed - GameEngine routes events directly.
}
