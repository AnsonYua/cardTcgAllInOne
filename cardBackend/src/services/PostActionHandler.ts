/**
 * PostActionHandler.ts - Unified Post-Action Processing Pipeline
 * 
 * Eliminates code duplication across action handlers by providing a standardized
 * post-action flow that ALL game actions should use for consistency.
 * 
 * Key Features:
 * - Unified player point calculation and update
 * - Consistent turn management across all actions
 * - Standardized phase progression logic
 * - Centralized event generation
 * - Metrics tracking integration
 */

import { GameEnvironment, EventType } from '../models/GameEnvironment';

export interface ActionContext {
    type: string;           // Action type (e.g., 'CARD_SELECTION', 'CARD_PLAY')
    playerId: string;       // Player who performed the action
    startTime: number;      // Action start timestamp for metrics
    skipTurnCheck?: boolean; // Skip turn progression (for special actions)
    skipPhaseCheck?: boolean; // Skip phase progression (for special actions)
}

export interface PostActionResult {
    success: boolean;
    gameEnv: GameEnvironment;
    turnSwitched?: boolean;
    phaseChanged?: boolean;
    error?: string;
}

export class PostActionHandler {
    private mozGamePlay: any;
    private enhancedEffectManager: any;

    constructor(mozGamePlay: any) {
        this.mozGamePlay = mozGamePlay;
        this.enhancedEffectManager = mozGamePlay?.enhancedEffectManager;
        
        console.log('🎯 PostActionHandler: Initialized with unified mozGamePlay delegation architecture');
    }

    /**
     * Main pipeline execution - standardized post-action flow
     */
    async execute(gameEnv: GameEnvironment, context: ActionContext): Promise<PostActionResult> {
        console.log(`🔄 PostActionHandler: Executing pipeline for ${context.type} by ${context.playerId}`);
        
        try {
            // STEP 1: Update player points using stored effects
            await this.updateAllPlayerPoints(gameEnv);

            // STEP 2: Turn management (if not skipped)
            let turnSwitched = false;
            if (!context.skipTurnCheck) {
                turnSwitched = await this.checkTurnProgression(gameEnv, context.playerId);
            }

            // STEP 3: Phase management (if not skipped)  
            let phaseChanged = false;
            if (!context.skipPhaseCheck) {
                phaseChanged = await this.checkPhaseProgression(gameEnv);
            }

            // STEP 4: Generate completion events
            this.generateCompletionEvents(gameEnv, context);

            // STEP 5: Update metrics (if available)
            this.updateMetrics(context);

            console.log(`✅ PostActionHandler: Pipeline completed for ${context.type}`);
            
            return {
                success: true,
                gameEnv: gameEnv,
                turnSwitched,
                phaseChanged
            };

        } catch (error) {
            console.error(`❌ PostActionHandler: Pipeline failed for ${context.type}:`, error);
            return {
                success: false,
                gameEnv: gameEnv,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * UNIFIED PLAYER POINT UPDATE - Single source of truth
     * Eliminates duplication between CardSelectionHandler and EnhancedEffectManager
     */
    private async updateAllPlayerPoints(gameEnv: GameEnvironment): Promise<void> {
        if (!this.enhancedEffectManager) {
            console.warn(`⚠️ EnhancedEffectManager not available - skipping player point updates`);
            return;
        }

        console.log(`📊 PostActionHandler: Updating player points using stored effects`);
        
        try {
            const playerIds = Object.keys(gameEnv.players);
            for (const playerId of playerIds) {
                const playerPoints = await this.enhancedEffectManager.calculatePlayerPoints(gameEnv, playerId);
                gameEnv.players[playerId].playerPoint = playerPoints;
                console.log(`✅ PostActionHandler: Player ${playerId} points updated to ${playerPoints}`);
            }
        } catch (error) {
            console.error(`❌ PostActionHandler: Error updating player points:`, error);
            throw error;
        }
    }

    /**
     * Turn progression management - unified through mozGamePlay → OptimizedGameEngine
     */
    private async checkTurnProgression(gameEnv: GameEnvironment, playerId: string): Promise<boolean> {
        // Unified architecture: PostActionHandler → mozGamePlay → OptimizedGameEngine
        if (!this.mozGamePlay) {
            console.log(`⚠️ PostActionHandler: mozGamePlay instance not available`);
            return false;
        }

        // Check for delegation method availability
        if (typeof this.mozGamePlay.shouldUpdateTurn !== 'function') {
            console.log(`⚠️ PostActionHandler: mozGamePlay.shouldUpdateTurn method not available`);
            console.log(`Available methods:`, Object.getOwnPropertyNames(this.mozGamePlay).filter(name => typeof this.mozGamePlay[name] === 'function'));
            return false;
        }

        try {
            console.log(`🎯 PostActionHandler: Calling mozGamePlay.shouldUpdateTurn for ${playerId}`);
            const turnResult = await this.mozGamePlay.shouldUpdateTurn(gameEnv, playerId);
            
            if (turnResult.turnSwitched) {
                // Add turn switch event
                this.addGameEvent(gameEnv, EventType.TURN_SWITCH, {
                    oldPlayer: playerId,
                    newPlayer: gameEnv.currentPlayer,
                    turn: gameEnv.currentTurn
                });
                
                console.log(`🔄 PostActionHandler: Turn switched from ${playerId} to ${gameEnv.currentPlayer}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`❌ PostActionHandler: Error checking turn progression:`, error);
            return false;
        }
    }

    /**
     * Phase progression management - unified through mozGamePlay → OptimizedGameEngine
     */
    private async checkPhaseProgression(gameEnv: GameEnvironment): Promise<boolean> {
        // Unified architecture: PostActionHandler → mozGamePlay → OptimizedGameEngine
        if (!this.mozGamePlay) {
            console.log(`⚠️ PostActionHandler: mozGamePlay instance not available`);
            return false;
        }

        // Check for delegation method availability
        if (typeof this.mozGamePlay.checkPhaseProgression !== 'function') {
            console.log(`⚠️ PostActionHandler: mozGamePlay.checkPhaseProgression method not available`);
            console.log(`Available methods:`, Object.getOwnPropertyNames(this.mozGamePlay).filter(name => typeof this.mozGamePlay[name] === 'function'));
            return false;
        }

        try {
            console.log(`🎯 PostActionHandler: Calling mozGamePlay.checkPhaseProgression`);
            const oldPhase = gameEnv.phase;
            await this.mozGamePlay.checkPhaseProgression(gameEnv);
            const newPhase = gameEnv.phase;
            
            if (oldPhase !== newPhase) {
                console.log(`🔄 PostActionHandler: Phase changed from ${oldPhase} to ${newPhase}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`❌ PostActionHandler: Error checking phase progression:`, error);
            return false;
        }
    }

    /**
     * Generate standardized completion events
     */
    private generateCompletionEvents(gameEnv: GameEnvironment, context: ActionContext): void {
        try {
            // Add action completion event
            this.addGameEvent(gameEnv, 'ACTION_COMPLETED', {
                actionType: context.type,
                playerId: context.playerId,
                timestamp: Date.now(),
                duration: Date.now() - context.startTime
            });
            
        } catch (error) {
            console.error(`❌ PostActionHandler: Error generating completion events:`, error);
        }
    }

    /**
     * Update metrics if available
     */
    private updateMetrics(context: ActionContext): void {
        try {
            if (this.mozGamePlay.config?.enableMetrics && this.mozGamePlay.updateMetrics) {
                this.mozGamePlay.updateMetrics(context.startTime);
            }
        } catch (error) {
            console.error(`❌ PostActionHandler: Error updating metrics:`, error);
        }
    }

    /**
     * Helper method to add game events
     */
    private addGameEvent(gameEnv: GameEnvironment, eventType: string, data: any): void {
        if (this.mozGamePlay.addGameEvent) {
            this.mozGamePlay.addGameEvent(gameEnv, eventType, data);
        }
    }

    /**
     * Factory method for creating action contexts
     */
    static createContext(type: string, playerId: string, options: Partial<ActionContext> = {}): ActionContext {
        return {
            type,
            playerId,
            startTime: Date.now(),
            skipTurnCheck: false,
            skipPhaseCheck: false,
            ...options
        };
    }
}

export default PostActionHandler;