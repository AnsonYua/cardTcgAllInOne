// src/services/effects/PhaseTransitionManager.ts
// Dedicated manager for phase transition detection and execution

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase, EventType } from '../../models/GameEnums';
import { GameEvent, EventStatus, EventPriority, EventFactory, NextPlayerTurnEvent, GameplayBeginsEvent } from '../EventQueue/interfaces/GameEvent';
import { StateBasedAction } from '../EventQueue/StateBasedActionEngine';
import { GameNotificationManager } from '../GameNotificationManager';

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
            // Also check that we haven't already processed a draw_to_main action recently
            const recentDrawToMainAction = notificationQueue.some(event =>
                event.type === 'PHASE_CHANGE' && 
                event.data?.reason?.includes('Auto-advance') &&
                event.timestamp > (Date.now() - 5000) // Within last 5 seconds
            );
            
            if (!recentDrawToMainAction) {
                console.log(`🎯 State-based action detected: DRAW_PHASE to MAIN_PHASE transition needed`);
                gameEnv.pendingPhaseTransition = EventType.PHASE_ADVANCE;
                actions.push({
                    actionId: `draw_to_main_${Date.now()}`,
                    type: EventType.PHASE_ADVANCE,
                    autoExecute: true
                });
            }
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

    /**
     * Execute GAMEPLAY_BEGINS event
     */
    static executeGameplayBegins(event: GameplayBeginsEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Executing GAMEPLAY_BEGINS event: ${event.id}`);
        
        try {
            gameEnv.pendingPhaseTransition = null;
            // Transition from REDRAW_PHASE to first player's turn
            gameEnv.phase = GamePhase.DRAW_PHASE;
            console.log(`✅ Game started: phase changed to ${gameEnv.phase}`);
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error executing GAMEPLAY_BEGINS:`, error);
            gameEnv.pendingPhaseTransition = null;
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Game start execution failed'
            };
        }
    }

    /**
        id: `state_${Date.now()}_${Math.random()}`,
        type: action.type,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        timestamp: Date.now(),
        // Pass action data directly without field reconstruction
        data: action.data || {}
     */
    static executePhaseAdvance(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Executing PHASE_ADVANCE event: ${event.id}`);

        try {
            gameEnv.pendingPhaseTransition = null;
            const currentPhase = gameEnv.phase;

            // Advance from DRAW_PHASE to MAIN_PHASE when appropriate
            if (currentPhase === GamePhase.DRAW_PHASE) {
                gameEnv.phase = GamePhase.MAIN_PHASE;
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
            gameEnv.phase = GamePhase.DRAW_PHASE;
            
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

    /**
     * Route event to appropriate phase transition execution method
     */
    static executePhaseTransition(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Routing phase transition event: ${event.type}`);
        
        switch (event.type) {
            case EventType.GAMEPLAY_BEGINS:
                return this.executeGameplayBegins(event as GameplayBeginsEvent, gameEnv);
            case EventType.PHASE_ADVANCE:
                return this.executePhaseAdvance(event, gameEnv);
            case EventType.NEXT_PLAYER_TURN:
                return this.executeNextPlayerTurn(event as NextPlayerTurnEvent, gameEnv);
            default:
                return {
                    success: false,
                    error: `Unknown phase transition event type: ${event.type}`
                };
        }
    }
}
