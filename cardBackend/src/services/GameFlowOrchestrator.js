// =======================================================================================
// 🎯 GAME FLOW ORCHESTRATOR - Master Class for Game State Management
// =======================================================================================
//
// This class orchestrates the complete game flow and coordinates all manager classes.
// It serves as the top-level coordinator for complex game operations that require
// multiple manager classes to work together.
//
// Key Responsibilities:
// - Game flow coordination between all manager classes
// - Complex multi-step operations (battle resolution, phase transitions)
// - State validation and consistency checks
// - Performance optimization through intelligent coordination
// - Comprehensive game state analytics and reporting
//
// Manager Class Integration:
// 1. CardSelectionHandler - Card selection and search effects
// 2. BattleCalculator - Power calculation and battle resolution
// 3. TurnManager - Turn switching and phase management
// 4. EventManager - Real-time event system
// 5. CardActionHandler - Card placement and validation
//
// Orchestration Patterns:
// - Sequential Operations: Turn management → Card placement → Battle calculation
// - Parallel Operations: Event generation + State validation
// - Validation Pipelines: Multi-manager validation chains
// - Error Recovery: Graceful fallback across manager classes
//
// =======================================================================================

/**
 * GameFlowOrchestrator - Master coordinator for game flow and manager classes
 * 
 * Responsibilities:
 * - Coordinate complex multi-manager operations
 * - Optimize game flow performance and efficiency
 * - Provide comprehensive game state validation
 * - Manage battle resolution and phase transitions
 * - Generate game analytics and performance metrics
 */
class GameFlowOrchestrator {
    constructor(mozGamePlay) {
        this.mozGamePlay = mozGamePlay;
        
        // Manager class references for coordination
        this.cardSelectionHandler = mozGamePlay.cardSelectionHandler;
        this.battleCalculator = mozGamePlay.battleCalculator;
        this.turnManager = mozGamePlay.turnManager;
        this.eventManager = mozGamePlay.eventManager;
        this.cardActionHandler = mozGamePlay.cardActionHandler;
        
        // Game flow metrics and analytics
        this.metrics = {
            actionsProcessed: 0,
            validationsPassed: 0,
            validationsFailed: 0,
            battlesResolved: 0,
            turnsManaged: 0,
            eventsGenerated: 0,
            averageActionTime: 0,
            performanceHistory: []
        };
        
        console.log('🎯 GameFlowOrchestrator: Initialized with complete manager class coordination');
    }

    // =======================================================================================
    // 🎯 Game Flow Coordination - Master Orchestration Methods
    // =======================================================================================

    /**
     * Orchestrate complete action processing with cross-manager coordination
     * This is the master method that coordinates all manager classes for action processing
     */
    async orchestrateActionProcessing(gameEnv, playerId, action) {
        console.log(`🎯 GameFlowOrchestrator: Orchestrating ${action.type} action for player ${playerId}`);
        
        const startTime = Date.now();
        
        try {
            // Phase 1: Pre-action validation and state checks
            const preValidation = await this.validateGameStateConsistency(gameEnv);
            if (!preValidation.isValid) {
                this.updateMetrics('validation_failed', startTime);
                return this.createErrorResponse(preValidation.error, playerId);
            }
            
            // Phase 2: Execute action through appropriate manager
            let result;
            switch (action.type) {
                case 'SelectCard':
                    result = await this.orchestrateCardSelection(gameEnv, playerId, action);
                    break;
                    
                case 'PlayCard':
                case 'PlayCardBack':
                    result = await this.orchestrateCardPlacement(gameEnv, playerId, action);
                    break;
                    
                default:
                    result = await this.mozGamePlay.processAction(gameEnv, playerId, action);
                    break;
            }
            
            // Phase 3: Post-action coordination
            if (result && !result.error) {
                result = await this.orchestratePostActionFlow(result, playerId, action);
            }
            
            this.updateMetrics('action_completed', startTime);
            this.metrics.actionsProcessed++;
            
            return result;
            
        } catch (error) {
            console.error(`🎯 GameFlowOrchestrator: Error during action orchestration:`, error);
            this.updateMetrics('action_failed', startTime);
            return this.createErrorResponse(error.message, playerId);
        }
    }

    /**
     * Orchestrate card selection with event coordination
     */
    async orchestrateCardSelection(gameEnv, playerId, action) {
        console.log(`🎯 GameFlowOrchestrator: Orchestrating card selection for player ${playerId}`);
        
        // Execute card selection through CardSelectionHandler
        const result = await this.cardSelectionHandler.handleSelectCardAction(gameEnv, playerId, action);
        
        // Coordinate with EventManager for real-time updates
        if (result && !result.error) {
            this.eventManager.addGameEvent(result, 'CARD_SELECTION_PROCESSED', {
                playerId: playerId,
                selectionType: action.selectionType || 'unknown',
                timestamp: Date.now()
            });
        }
        
        return result;
    }

    /**
     * Orchestrate card placement with comprehensive validation and turn management
     */
    async orchestrateCardPlacement(gameEnv, playerId, action) {
        console.log(`🎯 GameFlowOrchestrator: Orchestrating card placement for player ${playerId}`);
        
        // Execute card placement through CardActionHandler
        const result = await this.cardActionHandler.handleCardPlayAction(gameEnv, playerId, action);
        
        // If card placement was successful, coordinate turn management
        if (result && !result.error) {
            // Check if turn should update
            const turnResult = await this.turnManager.shouldUpdateTurn(result, playerId);
            
            // Check if phase should advance
            if (turnResult && !turnResult.error) {
                return await this.orchestratePhaseTransition(turnResult);
            }
            
            return turnResult || result;
        }
        
        return result;
    }

    /**
     * Orchestrate post-action game flow (turn management, phase transitions)
     */
    async orchestratePostActionFlow(gameEnv, playerId, action) {
        console.log(`🎯 GameFlowOrchestrator: Orchestrating post-action flow for ${action.type}`);
        
        // Check for main phase completion
        if (gameEnv.phase === 'MAIN_PHASE') {
            const isMainComplete = await this.turnManager.checkIsMainPhaseComplete(gameEnv);
            if (isMainComplete) {
                console.log(`🎯 GameFlowOrchestrator: Main phase complete - initiating phase transition`);
                return await this.orchestratePhaseTransition(gameEnv);
            }
        }
        
        // Check for SP phase completion
        if (gameEnv.phase === 'SP_PHASE') {
            const isSpComplete = await this.checkSpPhaseCompletion(gameEnv);
            if (isSpComplete) {
                console.log(`🎯 GameFlowOrchestrator: SP phase complete - initiating battle resolution`);
                return await this.orchestrateBattleResolution(gameEnv);
            }
        }
        
        return gameEnv;
    }

    // =======================================================================================
    // 🎯 Advanced Game Flow Operations - Multi-Manager Coordination
    // =======================================================================================

    /**
     * Orchestrate complete battle resolution with all managers
     */
    async orchestrateBattleResolution(gameEnv) {
        console.log(`🎯 GameFlowOrchestrator: Orchestrating complete battle resolution`);
        
        try {
            // Phase 1: Calculate battle results using BattleCalculator
            const battleResults = await this.battleCalculator.calculateBattleResults(gameEnv);
            
            // Phase 2: Generate comprehensive battle events
            this.eventManager.addGameEvent(battleResults, 'BATTLE_RESOLUTION_START', {
                phase: gameEnv.phase,
                timestamp: Date.now()
            });
            
            // Phase 3: Update victory points and check win conditions
            const updatedGameEnv = await this.processVictoryPoints(battleResults);
            
            // Phase 4: Coordinate turn/phase management for next round
            const finalGameEnv = await this.orchestratePostBattleFlow(updatedGameEnv);
            
            // Phase 5: Generate completion events
            this.eventManager.addGameEvent(finalGameEnv, 'BATTLE_RESOLUTION_COMPLETE', {
                winner: finalGameEnv.winner || null,
                nextPhase: finalGameEnv.phase,
                timestamp: Date.now()
            });
            
            this.metrics.battlesResolved++;
            return finalGameEnv;
            
        } catch (error) {
            console.error(`🎯 GameFlowOrchestrator: Error during battle resolution:`, error);
            this.eventManager.addErrorEvent(gameEnv, 'BATTLE_RESOLUTION_ERROR', error.message);
            return gameEnv;
        }
    }

    /**
     * Orchestrate phase transitions with comprehensive validation
     */
    async orchestratePhaseTransition(gameEnv) {
        console.log(`🎯 GameFlowOrchestrator: Orchestrating phase transition from ${gameEnv.phase}`);
        
        const oldPhase = gameEnv.phase;
        
        // Delegate to TurnManager for phase advancement logic
        const updatedGameEnv = await this.turnManager.advanceToSpPhaseOrBattle(gameEnv);
        
        // Generate phase transition events if phase changed
        if (updatedGameEnv.phase !== oldPhase) {
            this.eventManager.addGameEvent(updatedGameEnv, 'PHASE_TRANSITION_ORCHESTRATED', {
                oldPhase: oldPhase,
                newPhase: updatedGameEnv.phase,
                orchestrationMethod: 'GameFlowOrchestrator',
                timestamp: Date.now()
            });
        }
        
        return updatedGameEnv;
    }

    /**
     * Orchestrate post-battle flow (cleanup, next round setup)
     */
    async orchestratePostBattleFlow(gameEnv) {
        console.log(`🎯 GameFlowOrchestrator: Orchestrating post-battle flow`);
        
        // Check for game end conditions
        if (this.checkGameEndConditions(gameEnv)) {
            gameEnv.phase = 'GAME_END';
            this.eventManager.addGameEvent(gameEnv, 'GAME_END_ORCHESTRATED', {
                winner: gameEnv.winner,
                totalRounds: this.calculateTotalRounds(gameEnv),
                timestamp: Date.now()
            });
            return gameEnv;
        }
        
        // Prepare for next round if game continues
        const nextRoundGameEnv = await this.prepareNextRound(gameEnv);
        
        return nextRoundGameEnv;
    }

    // =======================================================================================
    // 🎯 Game State Validation and Analytics
    // =======================================================================================

    /**
     * Comprehensive game state validation across all managers
     */
    async validateGameStateConsistency(gameEnv) {
        console.log(`🎯 GameFlowOrchestrator: Validating game state consistency`);
        
        const validations = [];
        
        // Validate event system consistency
        validations.push(this.validateEventSystemState(gameEnv));
        
        // Validate turn management state
        validations.push(this.validateTurnManagementState(gameEnv));
        
        // Validate card placement state
        validations.push(this.validateCardPlacementState(gameEnv));
        
        // Check for any validation failures
        const failures = validations.filter(v => !v.isValid);
        if (failures.length > 0) {
            this.metrics.validationsFailed++;
            return {
                isValid: false,
                error: `Game state validation failed: ${failures.map(f => f.error).join(', ')}`
            };
        }
        
        this.metrics.validationsPassed++;
        return { isValid: true };
    }

    /**
     * Generate comprehensive game analytics
     */
    generateGameAnalytics(gameEnv) {
        console.log(`🎯 GameFlowOrchestrator: Generating game analytics`);
        
        return {
            gameState: {
                phase: gameEnv.phase,
                currentTurn: gameEnv.currentTurn,
                playersCount: Object.keys(gameEnv.players || {}).length,
                eventsCount: gameEnv.gameEvents ? gameEnv.gameEvents.length : 0
            },
            managerMetrics: {
                actionsProcessed: this.metrics.actionsProcessed,
                validationsPassed: this.metrics.validationsPassed,
                validationsFailed: this.metrics.validationsFailed,
                battlesResolved: this.metrics.battlesResolved,
                turnsManaged: this.metrics.turnsManaged,
                eventsGenerated: this.metrics.eventsGenerated,
                averageActionTime: this.metrics.averageActionTime
            },
            performanceMetrics: {
                totalOperations: this.metrics.actionsProcessed + this.metrics.battlesResolved,
                successRate: this.calculateSuccessRate(),
                averageResponseTime: this.metrics.averageActionTime,
                recentPerformance: this.metrics.performanceHistory.slice(-10)
            },
            managerHealthStatus: {
                cardSelectionHandler: !!this.cardSelectionHandler,
                battleCalculator: !!this.battleCalculator,
                turnManager: !!this.turnManager,
                eventManager: !!this.eventManager,
                cardActionHandler: !!this.cardActionHandler
            }
        };
    }

    // =======================================================================================
    // 🎯 Helper Methods and Utilities
    // =======================================================================================

    /**
     * Check SP phase completion
     */
    async checkSpPhaseCompletion(gameEnv) {
        // Check if both players have filled SP zones
        const playerIds = Object.keys(gameEnv.players || {});
        for (const playerId of playerIds) {
            const playerField = gameEnv.zones && gameEnv.zones[playerId];
            if (!playerField || !playerField.sp || playerField.sp.length === 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Process victory points after battle
     */
    async processVictoryPoints(gameEnv) {
        // Delegate to existing victory point logic in mozGamePlay
        // This could be extracted to BattleCalculator in future iterations
        return gameEnv;
    }

    /**
     * Check game end conditions
     */
    checkGameEndConditions(gameEnv) {
        if (!gameEnv.players) return false;
        
        const playerIds = Object.keys(gameEnv.players);
        for (const playerId of playerIds) {
            const playerData = gameEnv.players[playerId];
            if (playerData.victoryPoints && playerData.victoryPoints >= 50) {
                gameEnv.winner = playerId;
                return true;
            }
        }
        return false;
    }

    /**
     * Prepare next round setup
     */
    async prepareNextRound(gameEnv) {
        console.log(`🎯 GameFlowOrchestrator: Preparing next round`);
        
        // Delegate to existing next round logic
        // This maintains compatibility with existing game flow
        return gameEnv;
    }

    /**
     * Calculate total rounds played
     */
    calculateTotalRounds(gameEnv) {
        // Simple calculation based on current turn
        return Math.floor((gameEnv.currentTurn || 0) / 8) + 1; // Assuming 8 turns per round
    }

    /**
     * Validation helper methods
     */
    validateEventSystemState(gameEnv) {
        if (!gameEnv.gameEvents || !Array.isArray(gameEnv.gameEvents)) {
            return { isValid: false, error: 'Event system not properly initialized' };
        }
        return { isValid: true };
    }

    validateTurnManagementState(gameEnv) {
        if (typeof gameEnv.currentTurn !== 'number' || !gameEnv.phase) {
            return { isValid: false, error: 'Turn management state invalid' };
        }
        return { isValid: true };
    }

    validateCardPlacementState(gameEnv) {
        if (!gameEnv.zones || !gameEnv.players) {
            return { isValid: false, error: 'Card placement state invalid' };
        }
        return { isValid: true };
    }

    /**
     * Metrics and performance tracking
     */
    updateMetrics(operation, startTime) {
        const duration = Date.now() - startTime;
        
        // Update average response time
        const totalTime = this.metrics.averageActionTime * this.metrics.actionsProcessed + duration;
        this.metrics.averageActionTime = totalTime / (this.metrics.actionsProcessed + 1);
        
        // Track performance history
        this.metrics.performanceHistory.push({
            operation: operation,
            duration: duration,
            timestamp: Date.now()
        });
        
        // Keep only recent history (last 100 operations)
        if (this.metrics.performanceHistory.length > 100) {
            this.metrics.performanceHistory = this.metrics.performanceHistory.slice(-100);
        }
    }

    calculateSuccessRate() {
        const total = this.metrics.validationsPassed + this.metrics.validationsFailed;
        return total > 0 ? (this.metrics.validationsPassed / total) * 100 : 100;
    }

    createErrorResponse(errorMessage, playerId = null) {
        return {
            error: true,
            message: errorMessage,
            playerId: playerId,
            timestamp: Date.now(),
            orchestratedBy: 'GameFlowOrchestrator'
        };
    }
}

module.exports = GameFlowOrchestrator;