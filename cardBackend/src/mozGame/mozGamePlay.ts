// src/mozGame/mozGamePlay.ts

import * as path from 'path';
import { GameEnvironment, GamePhase, ZoneType, EventType, Player } from '../models/GameEnvironment';
import CardInfoUtils from '../services/CardInfoUtils';
// Removed: effectSimulator import - legacy system replaced by EnhancedEffectManager

// Import JavaScript modules (will be converted later in the migration)
const mozDeckHelper = require('./mozDeckHelper');
const mozPhaseManager = require('./mozPhaseManager');
// Legacy CardEffectManager removed - using EnhancedEffectManager instead
// FieldEffectProcessor removed - legacy functionality moved to OptimizedGameEngine
const { getPlayerFromGameEnv, getPlayerField } = require('../utils/gameUtils');
const playSequenceManager = require('../services/PlaySequenceManager');

// Manager classes
import { CardSelectionHandler } from '../services/CardSelectionHandler';
import BattleCalculator from '../services/BattleCalculator';
const TurnManager = require('../services/TurnManager');
const EventManager = require('../services/EventManager');
const CardActionHandler = require('../services/CardActionHandler');
const GameFlowOrchestrator = require('../services/GameFlowOrchestrator');

// Utility modules
const PlayerStateManager = require('../utils/PlayerStateManager');
const CardDataValidator = require('../utils/CardDataValidator');
const ZoneManager = require('../utils/ZoneManager');

// ============ TYPE DEFINITIONS ============

export enum TurnPhase {
    START_REDRAW = 'START_REDRAW',
    DRAW_PHASE = 'DRAW_PHASE',
    MAIN_PHASE = 'MAIN_PHASE',
    SP_PHASE = 'SP_PHASE',
    END_SUMMONER_BATTLE = 'END_SUMMONER_BATTLE',
    MAIN_PHASE_1 = 'MAIN_PHASE_1',
    BATTLE_PHASE = 'BATTLE_PHASE',
    MAIN_PHASE_2 = 'MAIN_PHASE_2',
    END_PHASE = 'END_PHASE',
    GAME_END = 'GAME_END',
    END_LEADER_BATTLE = 'END_LEADER_BATTLE'
}

export interface PlayerAction {
    type: string;
    playerId?: string;
    isRedraw?: boolean;
    cardUID?: string;  // Modern card identification
    zone?: string;
    [key: string]: any;
}

export interface GamePlayResult {
    success: boolean;
    gameEnv?: GameEnvironment;
    error?: string;
    requiresCardSelection?: boolean;
    cardSelectionId?: string;
}

export interface BattleResult {
    winner?: string;
    player1Power: number;
    player2Power: number;
    combos: any[];
    powerBreakdown: any;
}

export interface CardData {
    id: string;
    name: string;
    cardType: string;
    gameType?: string;
    power?: number;
    traits?: string[];
    effects?: any;
    zoneCompatibility?: any;
    [key: string]: any;
}

// ============ MAIN MOZGAMEPLAY CLASS ============

export class MozGamePlay {
    // Legacy cardEffectManager removed - using EnhancedEffectManager instead
    public cardInfoUtils: typeof CardInfoUtils;
    // fieldEffectProcessor removed - legacy functionality moved to OptimizedGameEngine
    public playSequenceManager: any;
    public enhancedEffectManager: any; // Modern effect manager for power/point recalculation
    
    // Manager classes
    public cardSelectionHandler: any;
    public battleCalculator: any;
    public turnManager: any;
    public eventManager: any;
    public cardActionHandler: any;
    public gameFlowOrchestrator: any;

    constructor() {
        // Legacy cardEffectManager removed - using EnhancedEffectManager instead
        this.cardInfoUtils = CardInfoUtils;
        // FieldEffectProcessor removed - legacy functionality moved to OptimizedGameEngine
        
        // UNIFIED EFFECT SYSTEM: Dependencies for direct effect processing
        // NOTE: These are injected by GameLogic.ts during initialization to ensure proper dependency setup
        this.playSequenceManager = null;
        this.enhancedEffectManager = null; // Injected by GameLogic.ts during initialization
        
        // Initialize manager classes
        this.cardSelectionHandler = new CardSelectionHandler(this);
        this.battleCalculator = new BattleCalculator(this);
        this.turnManager = new TurnManager(this);
        this.eventManager = new EventManager();
        this.cardActionHandler = new CardActionHandler(this);
        this.gameFlowOrchestrator = new GameFlowOrchestrator(this);
    }

    // ============ MAIN CONTROL FLOW METHODS ============

    /**
     * Main entry point for ALL player actions
     * Validates permissions, phase restrictions, and game state
     * Routes to specific action handlers based on action.type
     * 
     * @param gameEnv - Game environment (can be JSON or GameEnvironment class)
     * @param action - Player action object
     * @returns Promise<GamePlayResult>
     */
    async processAction(gameEnv: GameEnvironment | any, action: PlayerAction): Promise<GamePlayResult> {
        try {
            console.log(`🎮 Processing action: ${action.type} for player: ${action.playerId}`);
            
            // Convert to GameEnvironment class if needed
            const gameEnvClass = this.ensureGameEnvironmentClass(gameEnv);
            
            // Validate action permissions and phase
            const validationResult = await this.validateAction(gameEnvClass, action);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: validationResult.error
                };
            }
            
            // Route to specific action handler
            let result: GamePlayResult;
            
            switch (action.type) {
                case 'PlayCard':
                    result = await this.handlePlayCard(gameEnvClass, action);
                    break;
                
                case 'PlayLeader':
                    result = await this.handlePlayLeader(gameEnvClass, action);
                    break;
                
                case 'DrawCard':
                    result = await this.handleDrawCard(gameEnvClass, action);
                    break;
                
                case 'EndTurn':
                    result = await this.handleEndTurn(gameEnvClass, action);
                    break;
                
                case 'Redraw':
                    result = await this.handleRedraw(gameEnvClass, action);
                    break;
                
                default:
                    return {
                        success: false,
                        error: `Unknown action type: ${action.type}`
                    };
            }
            
            // Process unified effects if action was successful
            if (result.success && result.gameEnv) {
                await this.processUnifiedEffects(result.gameEnv);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Error processing action:', error);
            return {
                success: false,
                error: `Failed to process action: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Complete battle calculation system
     * Calculates final power values and determines winner
     * 
     * @param gameEnv - Game environment
     * @param playerId - Player ID to calculate for
     * @returns Promise<number> - Player's total power
     */
    async calculatePlayerPoint(gameEnv: GameEnvironment | any, playerId: string): Promise<number> {
        try {
            console.log(`⚡ Calculating power for player: ${playerId}`);
            
            const gameEnvClass = this.ensureGameEnvironmentClass(gameEnv);
            const player = gameEnvClass.getPlayer(playerId);
            
            if (!player) {
                console.warn(`Player ${playerId} not found`);
                return 0;
            }
            
            // Use battle calculator for power computation
            const totalPower = await this.battleCalculator.calculatePlayerPoints(gameEnvClass, playerId);
            
            // Update player's power in game state
            player.playerPoint = totalPower;
            
            console.log(`✅ Player ${playerId} total power: ${totalPower}`);
            return totalPower;
            
        } catch (error) {
            console.error(`❌ Error calculating power for ${playerId}:`, error);
            return 0;
        }
    }

    /**
     * Battle phase processing - determines round winner
     * 
     * @param gameEnv - Game environment
     * @returns Promise<BattleResult>
     */
    async processBattlePhase(gameEnv: GameEnvironment | any): Promise<BattleResult> {
        try {
            console.log('⚔️ Processing battle phase...');
            
            const gameEnvClass = this.ensureGameEnvironmentClass(gameEnv);
            
            // Calculate power for both players
            const player1Power = gameEnvClass.playerId_1 ? 
                await this.calculatePlayerPoint(gameEnvClass, gameEnvClass.playerId_1) : 0;
            const player2Power = gameEnvClass.playerId_2 ? 
                await this.calculatePlayerPoint(gameEnvClass, gameEnvClass.playerId_2) : 0;
            
            // Determine winner
            let winner: string | undefined;
            if (player1Power > player2Power) {
                winner = gameEnvClass.playerId_1 || undefined;
            } else if (player2Power > player1Power) {
                winner = gameEnvClass.playerId_2 || undefined;
            }
            // If powers are equal, it's a tie (winner remains undefined)
            
            // Add battle result event
            gameEnvClass.eventManager.addEvent(EventType.BATTLE_RESULT, {
                winner: winner,
                player1Power: player1Power,
                player2Power: player2Power,
                timestamp: Date.now()
            });
            
            console.log(`⚔️ Battle result - Player 1: ${player1Power}, Player 2: ${player2Power}, Winner: ${winner || 'Tie'}`);
            
            return {
                winner: winner,
                player1Power: player1Power,
                player2Power: player2Power,
                combos: [], // TODO: Implement combo detection
                powerBreakdown: {} // TODO: Implement power breakdown
            };
            
        } catch (error) {
            console.error('❌ Error processing battle phase:', error);
            throw error;
        }
    }

    // ============ ACTION HANDLERS ============

    /**
     * Handle card play action
     */
    private async handlePlayCard(gameEnv: GameEnvironment, action: PlayerAction): Promise<GamePlayResult> {
        try {
            console.log(`🃏 Handling play card: ${action.cardUID}`);
            
            // Extract card information - only accept cardUID
            const cardId = action.cardUID;
            
            if (!cardId) {
                return {
                    success: false,
                    error: 'cardUID is required for play card action'
                };
            }
            const zone = this.mapFieldIndexToZone(action.field_idx);
            
            if (!zone) {
                return {
                    success: false,
                    error: 'Invalid zone specified'
                };
            }
            
            // Use card action handler for placement logic
            const result = await this.cardActionHandler.playCard(gameEnv, action.playerId!, cardId, zone!, false);
            
            if (result.success) {
                return {
                    success: true,
                    gameEnv: gameEnv,
                    requiresCardSelection: result.requiresCardSelection,
                    cardSelectionId: result.cardSelectionId
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }
            
        } catch (error) {
            console.error('❌ Error handling play card:', error);
            return {
                success: false,
                error: `Failed to play card: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Handle leader play action
     */
    private async handlePlayLeader(gameEnv: GameEnvironment, action: PlayerAction): Promise<GamePlayResult> {
        try {
            console.log(`👑 Handling play leader: ${action.cardUID}`);
            
            const leaderId = action.cardUID;
            if (!leaderId) {
                return {
                    success: false,
                    error: 'cardUID is required for play leader action'
                };
            }
            
            // Use card action handler for leader placement
            const result = await this.cardActionHandler.playLeader(gameEnv, action.playerId!, leaderId!);
            
            if (result.success) {
                return {
                    success: true,
                    gameEnv: gameEnv
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }
            
        } catch (error) {
            console.error('❌ Error handling play leader:', error);
            return {
                success: false,
                error: `Failed to play leader: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Handle draw card action
     */
    private async handleDrawCard(gameEnv: GameEnvironment, action: PlayerAction): Promise<GamePlayResult> {
        try {
            console.log(`🎯 Handling draw card for player: ${action.playerId}`);
            
            const player = gameEnv.getPlayer(action.playerId!);
            if (!player) {
                return {
                    success: false,
                    error: 'Player not found'
                };
            }
            
            // Check if deck has cards to draw
            if (player.deck.getDeckSize() === 0) {
                return {
                    success: false,
                    error: 'No cards left to draw'
                };
            }
            
            // Use PlayerDeckDataResp.drawCard() method instead of mozDeckHelper
            const drawnCardUid = player.deck.drawCard();
            
            if (!drawnCardUid) {
                return {
                    success: false,
                    error: 'Failed to draw card'
                };
            }
            
            // Add draw event
            gameEnv.eventManager.addEvent(EventType.CARD_DRAWN, {
                playerId: action.playerId,
                cardCount: 1,
                cardUid: drawnCardUid,
                newHandSize: player.deck.getHandSize(),
                timestamp: Date.now()
            });
            
            console.log(`✅ Player ${action.playerId} drew 1 card`);
            
            return {
                success: true,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error handling draw card:', error);
            return {
                success: false,
                error: `Failed to draw card: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Handle end turn action
     */
    private async handleEndTurn(gameEnv: GameEnvironment, action: PlayerAction): Promise<GamePlayResult> {
        try {
            console.log(`🔄 Handling end turn for player: ${action.playerId}`);
            
            // Use turn manager for turn logic
            const result = await this.turnManager.endTurn(gameEnv, action.playerId!);
            
            if (result.success) {
                return {
                    success: true,
                    gameEnv: gameEnv
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }
            
        } catch (error) {
            console.error('❌ Error handling end turn:', error);
            return {
                success: false,
                error: `Failed to end turn: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Handle redraw action
     */
    private async handleRedraw(gameEnv: GameEnvironment, action: PlayerAction): Promise<GamePlayResult> {
        try {
            console.log(`🔀 Handling redraw for player: ${action.playerId}, isRedraw: ${action.isRedraw}`);
            
            const player = gameEnv.getPlayer(action.playerId!);
            if (!player) {
                return {
                    success: false,
                    error: 'Player not found'
                };
            }
            
            // Process redraw using GameEnvironment method
            const redrawResult = await gameEnv.processPlayerRedraw(action.playerId!, action.isRedraw || false);
            
            console.log(`✅ Redraw processed for player ${action.playerId}`);
            
            return {
                success: true,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error handling redraw:', error);
            return {
                success: false,
                error: `Failed to process redraw: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // ============ UTILITY METHODS ============

    /**
     * Ensure game environment is a GameEnvironment class instance
     */
    private ensureGameEnvironmentClass(gameEnv: GameEnvironment | any): GameEnvironment {
        if (gameEnv instanceof GameEnvironment) {
            return gameEnv;
        }
        
        // Convert from JSON to GameEnvironment class
        return GameEnvironment.fromJSON(gameEnv);
    }

    /**
     * Validate action permissions and phase restrictions
     */
    private async validateAction(gameEnv: GameEnvironment, action: PlayerAction): Promise<{valid: boolean, error?: string}> {
        // Check if player exists
        const player = gameEnv.getPlayer(action.playerId!);
        if (!player) {
            return {
                valid: false,
                error: 'Player not found'
            };
        }
        
        // Check if it's player's turn (for most actions)
        if (action.type !== 'Redraw' && gameEnv.currentPlayer !== action.playerId) {
            return {
                valid: false,
                error: 'Not your turn'
            };
        }
        
        // Phase-specific validations
        const currentPhase = gameEnv.phase;
        
        switch (action.type) {
            case 'PlayCard':
                if (currentPhase !== GamePhase.MAIN_PHASE && currentPhase !== GamePhase.SP_PHASE) {
                    return {
                        valid: false,
                        error: `Cannot play cards during ${currentPhase}`
                    };
                }
                break;
            
            case 'PlayLeader':
                if (currentPhase !== GamePhase.MAIN_PHASE) {
                    return {
                        valid: false,
                        error: `Cannot play leader during ${currentPhase}`
                    };
                }
                break;
            
            case 'DrawCard':
                if (currentPhase !== GamePhase.DRAW_PHASE) {
                    return {
                        valid: false,
                        error: `Cannot draw cards during ${currentPhase}`
                    };
                }
                break;
                
            case 'Redraw':
                if (currentPhase !== GamePhase.START_REDRAW && currentPhase !== GamePhase.REDRAW_PHASE) {
                    return {
                        valid: false,
                        error: `Cannot redraw during ${currentPhase}`
                    };
                }
                break;
        }
        
        return { valid: true };
    }

    /**
     * Process unified effects after successful actions
     */
    private async processUnifiedEffects(gameEnv: GameEnvironment): Promise<void> {
        try {
            console.log('⚡ Processing unified effects...');
            
            // Note: Effect processing now handled by EnhancedEffectManager in OptimizedGameEngine
            // Avoiding double processing by disabling EffectSimulator here
            console.log('ℹ️ Unified effects delegated to EnhancedEffectManager for incremental processing');
            
        } catch (error) {
            console.error('❌ Error processing unified effects:', error);
        }
    }

    /**
     * Map field index to zone type
     */
    private mapFieldIndexToZone(fieldIndex?: number): string | null {
        const zoneMap: { [key: number]: string } = {
            1: ZoneType.LEFT,
            2: ZoneType.TOP, 
            3: ZoneType.RIGHT,
            4: ZoneType.HELP,
            5: ZoneType.SP
        };
        
        return fieldIndex ? (zoneMap[fieldIndex] || null) : null;
    }

    // ============ POSTACTIONHANDLER DELEGATION METHODS ============
    
    /**
     * Delegate turn management to TurnManager for consistent behavior
     * Used by PostActionHandler for unified turn switching
     */
    async shouldUpdateTurn(gameEnv: GameEnvironment, playerId: string): Promise<{ turnSwitched: boolean }> {
        console.log('🎯 mozGamePlay: Using TurnManager for turn management');
        return await this.turnManager.shouldUpdateTurn(gameEnv, playerId);
    }

    /**
     * Basic phase progression implementation
     * Used by PostActionHandler for unified phase progression
     */
    async checkPhaseProgression(gameEnv: GameEnvironment): Promise<void> {
        console.log('🎯 mozGamePlay: Using basic phase progression');
        
        // Basic phase progression logic - can be expanded as needed
        // For now, just return without changing phase to avoid errors
        // TODO: Implement proper phase progression logic here if needed
        return Promise.resolve();
    }

    // ============ LEGACY COMPATIBILITY ============

    // Legacy methods getCardDetails() and getLeaderCards() removed - use CardInfoUtils directly instead
}

// ============ EXPORT SINGLETON ============

// Create singleton instance for backward compatibility
export const mozGamePlay = new MozGamePlay();
export default mozGamePlay;