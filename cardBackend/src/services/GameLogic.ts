// src/services/GameLogic.ts

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Request, Response } from 'express';

// Import TypeScript modules with proper types
import { GameEnvironment, GamePhase, ActionType, ZoneType, EventType, Player } from '../models/GameEnvironment';
import { GameEnvironmentAdapter } from '../utils/GameEnvironmentAdapter';
// PLACEHOLDER: Enhanced effect manager - implement effect processing functionality

// Import JavaScript modules (will be converted later)  
const mozGamePlayModule = require('../mozGame/mozGamePlay');
const mozGamePlay = mozGamePlayModule.default || mozGamePlayModule;
const mozAIClass = require('../mozGame/mozAIClass');
const playSequenceManager = require('./PlaySequenceManager');
// Legacy CardEffectRegistry removed - using EnhancedEffectManager instead

// Import TypeScript modules
import mozDeckHelper from '../mozGame/mozDeckHelper';

// ============ TYPE DEFINITIONS ============

export interface GameLogicResult {
    success: boolean;
    gameId?: string;
    gameEnv?: GameEnvironment;
    error?: string;
    requiresCardSelection?: boolean;
}

export interface CardPlayResult {
    success: boolean;
    error?: string;
    gameState?: GameEnvironment;
    requiresCardSelection?: boolean;
    processingTime?: number;
}

export interface PlayerActionResult {
    success: boolean;
    gameId?: string;
    error?: string;
    gameEnv?: GameEnvironment;
    requiresCardSelection?: boolean;
    cardSelectionId?: string;
}

export interface CardSelection {
    selectionId: string;
    sourceCard: string;
    availableCards: string[];
    playerAction: any;
    reason: string;
}

// ============ UTILITY FUNCTIONS ============

// Utility function to update game phase
function updatePhase(gameEnv: GameEnvironment, newPhase: GamePhase): void {
    gameEnv.phase = newPhase;
    console.log(`🎯 Phase updated to: ${newPhase}`);
}

// PLACEHOLDER: Game engine initialization - implement game setup logic
async function initializeGameEngine(gameId: string): Promise<void> {
    console.log(`🚀 [PLACEHOLDER] Initializing game engine for game: ${gameId}...`);
    // TODO: Implement game initialization logic
    // - Set up game state
    // - Initialize card systems
    // - Prepare for gameplay
    console.log(`✅ [PLACEHOLDER] Game engine initialized for game: ${gameId}`);
}

// PLACEHOLDER: Initialize game state - implement game setup logic
async function initializeGame(gameEnv: GameEnvironment): Promise<void> {
    console.log(`🎮 [PLACEHOLDER] Initializing game state...`);
    // TODO: Implement game state initialization
    // - Set up initial game state
    // - Initialize player resources
    // - Prepare game mechanics
    console.log(`✅ [PLACEHOLDER] Game state initialized`);
}

// PLACEHOLDER: Play card function - implement card placement logic
async function playCard(
    gameEnv: GameEnvironment, 
    playerId: string, 
    cardUID: string, 
    zone: any, 
    faceDown: boolean
): Promise<CardPlayResult> {
    console.log(`🃏 [PLACEHOLDER] Playing card: ${cardUID} for player ${playerId} in zone ${zone}, faceDown: ${faceDown}`);
    
    // TODO: Implement card play logic
    // - Validate card placement
    // - Apply card effects
    // - Update game state
    // - Process turn progression
    
    // Return placeholder success result
    return {
        success: true,
        gameState: gameEnv,
        requiresCardSelection: false,
        processingTime: Date.now()
    };
}

// PLACEHOLDER: Select card function - implement card selection logic
async function selectCard(
    gameEnv: GameEnvironment,
    selectionId: string,
    selectedCardIdentifiers: string[]
): Promise<{success: boolean; error?: string; gameState?: GameEnvironment}> {
    console.log(`🎯 [PLACEHOLDER] Selecting cards: ${selectedCardIdentifiers.join(', ')} for selection ${selectionId}`);
    
    // TODO: Implement card selection logic
    // - Validate selection
    // - Apply selection effects
    // - Update pending selections
    // - Process turn progression
    
    // Return placeholder success result
    return {
        success: true,
        gameState: gameEnv
    };
}

// PLACEHOLDER: Card Selection Handler - implement comprehensive card selection system
class CardSelectionHandlerPlaceholder {
    constructor(mozGamePlay: any, gameId?: string) {
        console.log('🚧 [PLACEHOLDER] CardSelectionHandler initialized - implement actual functionality');
        // TODO: Implement card selection handler initialization
        // - Set up card selection state management
        // - Initialize selection validation rules
        // - Prepare selection effect processing
    }

    async handleSelectCardAction(
        gameEnv: GameEnvironment, 
        playerId: string, 
        action: any
    ): Promise<{success: boolean; error?: string; gameState?: GameEnvironment}> {
        console.log(`🎯 [PLACEHOLDER] Handling select card action for player: ${playerId}`, action);
        
        // TODO: Implement comprehensive card selection logic
        // - Process different selection types (deck search, field target, etc.)
        // - Validate player selections
        // - Apply card effects based on selection
        // - Update game state accordingly
        // - Handle turn progression
        
        // Return placeholder result
        return {
            success: false,
            error: 'Card selection functionality not implemented - placeholder needed',
            gameState: gameEnv
        };
    }
}

// PLACEHOLDER: Enhanced Effect Manager - implement effect processing system
class EnhancedEffectManagerPlaceholder {
    constructor() {
        console.log('🚧 [PLACEHOLDER] EnhancedEffectManager initialized - implement actual functionality');
    }

    setCalculatePlayerPointFunction(calculateFunction: any): void {
        console.log('🚧 [PLACEHOLDER] Calculate player point function not implemented');
        // TODO: Implement player point calculation function setup
    }

    async processCardEffects(gameEnv: GameEnvironment, action: any, trigger: string): Promise<void> {
        console.log(`🚧 [PLACEHOLDER] Processing card effects for trigger: ${trigger} - not implemented`);
        // TODO: Implement card effect processing logic
        // - Parse card effects from card data
        // - Apply effects based on triggers
        // - Update game state accordingly
    }

    async calculateAllPlayerPoints(gameEnv: GameEnvironment): Promise<void> {
        console.log('🚧 [PLACEHOLDER] Calculate all player points - not implemented');
        // TODO: Implement player point calculation
        // - Calculate base card powers
        // - Apply power modifications from effects
        // - Update player scores
    }
}

// PLACEHOLDER: Turn Manager - implement turn management system
class TurnManagerPlaceholder {
    constructor(mozGamePlay: any) {
        console.log('🚧 [PLACEHOLDER] TurnManager initialized - implement actual functionality');
        // TODO: Implement turn manager initialization
        // - Set up turn state tracking
        // - Initialize turn progression logic
        // - Prepare turn validation rules
    }

    async endTurn(gameEnv: GameEnvironment, playerId: string): Promise<{success: boolean; error?: string}> {
        console.log(`🚧 [PLACEHOLDER] End turn for player: ${playerId} - not implemented`);
        // TODO: Implement end turn logic
        // - Validate turn ending conditions
        // - Apply end-of-turn effects
        // - Switch to next player
        // - Update turn counter
        
        return { success: false, error: 'Turn management not implemented' };
    }

    async shouldUpdateTurn(gameEnv: GameEnvironment, playerId: string): Promise<boolean> {
        console.log(`🚧 [PLACEHOLDER] Should update turn check for player: ${playerId} - not implemented`);
        // TODO: Implement turn update logic
        // - Check if turn should progress
        // - Validate player actions
        // - Determine next turn state
        
        return false; // Placeholder - no turn updates
    }
}

// PLACEHOLDER: Game Flow Orchestrator - implement game flow coordination
class GameFlowOrchestratorPlaceholder {
    constructor(mozGamePlay: any) {
        console.log('🚧 [PLACEHOLDER] GameFlowOrchestrator initialized - implement actual functionality');
        // TODO: Implement game flow orchestrator initialization
        // - Set up game state coordination
        // - Initialize phase management
        // - Prepare flow validation rules
    }

    async orchestrateCardSelection(gameEnv: GameEnvironment, playerId: string, action: any): Promise<{success: boolean; error?: string}> {
        console.log(`🚧 [PLACEHOLDER] Orchestrate card selection for player: ${playerId} - not implemented`);
        // TODO: Implement card selection orchestration
        // - Coordinate selection workflow
        // - Validate selection rules  
        // - Apply selection effects
        // - Update game flow state
        
        return { success: false, error: 'Card selection orchestration not implemented' };
    }
}

// PLACEHOLDER: Post Action Handler - implement post-action processing
class PostActionHandlerPlaceholder {
    constructor(mozGamePlay: any) {
        console.log('🚧 [PLACEHOLDER] PostActionHandler initialized - implement actual functionality');
        // TODO: Implement post action handler initialization
        // - Set up action processing pipeline
        // - Initialize validation rules
        // - Prepare state update logic
    }

    async execute(gameEnv: GameEnvironment, context: any): Promise<{success: boolean; gameEnv: GameEnvironment}> {
        console.log('🚧 [PLACEHOLDER] Execute post action processing - not implemented', context);
        // TODO: Implement post action execution
        // - Process action consequences
        // - Update player states
        // - Handle turn progression
        // - Apply game rule validations
        
        return { success: false, gameEnv };
    }
}

// Export the placeholder classes for use in other modules
export { CardSelectionHandlerPlaceholder, EnhancedEffectManagerPlaceholder, TurnManagerPlaceholder, GameFlowOrchestratorPlaceholder, PostActionHandlerPlaceholder };

// Draw card function for first player at game start
function drawCardForCurrentPlayer(gameEnvClass: GameEnvironment): boolean {
    const currentPlayerId = gameEnvClass.currentPlayer;
    if (!currentPlayerId) {
        console.warn('No current player set');
        return false;
    }
    const currentPlayer = gameEnvClass.getPlayer(currentPlayerId);
    
    if (!currentPlayer) {
        console.warn(`Current player ${currentPlayerId} not found`);
        return false;
    }
    
    // Check if deck has cards to draw
    if (currentPlayer.deck.getDeckSize() === 0) {
        console.warn(`Player ${currentPlayerId} has no cards left to draw`);
        return false;
    }
    
    // Use PlayerDeckDataResp.drawCard() method instead of mozDeckHelper
    const drawnCardUid = currentPlayer.deck.drawCard();
    
    if (!drawnCardUid) {
        console.warn(`Failed to draw card for player ${currentPlayerId}`);
        return false;
    }
    
    // CENTRALIZED: Use mozGamePlay.addGameEvent for consistent event handling
    // This automatically handles the requireFrontendAcknowledgment flag for DRAW_PHASE_COMPLETE
    mozGamePlay.addGameEvent(gameEnvClass, EventType.DRAW_PHASE_COMPLETE, {
        playerId: currentPlayerId,
        cardCount: 1,
        cardUid: drawnCardUid,
        newHandSize: currentPlayer.deck.getHandSize()
    });
    
    console.log(`🎯 Player ${currentPlayerId} drew 1 card (${drawnCardUid}). New hand size: ${currentPlayer.deck.getHandSize()}`);
    return true;
}

// ============ MAIN GAMELOGIC CLASS ============

export class GameLogic {
    private mozGamePlay: any;
    private baseDataPath: string;

    constructor() {
        this.mozGamePlay = mozGamePlay;
        this.baseDataPath = path.join(__dirname, '../gameData');
        
        // Initialize EnhancedEffectManager with dependencies (EFFICIENT INCREMENTAL APPROACH)
        // IMPORTANT: Inject mozGamePlay.calculatePlayerPoint to avoid circular dependency (with defensive binding)
        if (this.mozGamePlay && this.mozGamePlay.calculatePlayerPoint) {
        // PLACEHOLDER: Set up effect manager calculation function
        const enhancedEffectManager = new EnhancedEffectManagerPlaceholder();
        enhancedEffectManager.setCalculatePlayerPointFunction(this.mozGamePlay.calculatePlayerPoint.bind(this.mozGamePlay));
            console.log('✅ GameLogic: mozGamePlay dependency injected into EnhancedEffectManager');
        }
        
        // BIDIRECTIONAL INJECTION: Inject EnhancedEffectManager back into mozGamePlay
        if (this.mozGamePlay) {
            // PLACEHOLDER: Inject effect manager into mozGamePlay
            const enhancedEffectManagerInstance = new EnhancedEffectManagerPlaceholder();
            this.mozGamePlay.enhancedEffectManager = enhancedEffectManagerInstance;
            console.log('✅ GameLogic: EnhancedEffectManager placeholder injected into mozGamePlay');
        }
        
        console.log('🎮 GameLogic initialized with TypeScript class support');
    }

    // ============ CORE GAME METHODS ============

    /**
     * Create a new game with enhanced TypeScript support
     * @param playerId - Player ID creating the game
     * @returns Promise<GameLogicResult>
     */
    async createGame(playerId: string): Promise<GameLogicResult> {
        try {
            console.log(`🎮 Creating new game for player: ${playerId}`);
            
            const gameId = uuidv4();
            const gameEnv = new GameEnvironment();
            
            // Initialize game with TypeScript class structure
            gameEnv.playerId_1 = playerId;
            gameEnv.phase = GamePhase.WAITING_FOR_PLAYERS;
            gameEnv.gameStarted = false;
            gameEnv.firstPlayer = 0;
            gameEnv.currentPlayer = playerId;
            gameEnv.currentTurn = 1;
            // Initialize game engine for this game
            await initializeGameEngine(gameId);
            // Add first player to game
            gameEnv.addPlayer(playerId, `Player 1`);
            // Add game creation event
            gameEnv.eventManager.addEvent(EventType.GAME_CREATED, {
                gameId: gameId,
                createdBy: playerId,
                phase: gameEnv.phase,
                timestamp: Date.now()
            });
            console.log("aaa",JSON.stringify(gameEnv))
            // Save game to file system
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Game created successfully: ${gameId}`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error creating game:', error);
            return {
                success: false,
                error: `Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Join an existing game with complete initialization
     * @param gameId - Game ID to join
     * @param playerId - Player ID joining
     * @returns Promise<GameLogicResult>
     */
    async joinGame(gameId: string, playerId: string): Promise<GameLogicResult> {
        try {
            console.log(`🎮 Player ${playerId} joining game: ${gameId}`);
            
            // Load existing game
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Check if room is available
            if (gameEnv.phase !== GamePhase.WAITING_FOR_PLAYERS) {
                return {
                    success: false,
                    error: 'Room is not available for joining'
                };
            }
            
            // Check if game is full
            if (gameEnv.playerId_2 && gameEnv.playerId_2 !== playerId) {
                return {
                    success: false,
                    error: 'Game is full'
                };
            }
            
            // Add second player if not already added
            if (!gameEnv.playerId_2) {
                gameEnv.playerId_2 = playerId;
                gameEnv.addPlayer(playerId, `Player 2`);
                
                console.log(`📋 Preparing decks for both players...`);
                
                // Now prepare decks for both players (MISSING FUNCTIONALITY RESTORED)
                const player1Id = gameEnv.playerId_1!;
                const player2Id = gameEnv.playerId_2!;
                
                // Prepare decks using TypeScript mozDeckHelper
                const startTasks = [
                    mozDeckHelper.prepareDeckForPlayer(player1Id),
                    mozDeckHelper.prepareDeckForPlayer(player2Id)
                ];
                
                const deckResults = await Promise.all(startTasks);
                const player1DeckData = deckResults[0];
                const player2DeckData = deckResults[1];
                
                console.log(`🎯 Decks prepared. Player 1 hand size: ${player1DeckData.hand.length}, Player 2 hand size: ${player2DeckData.hand.length}`);
                
                // Set up game environment with decks using GameEnvironmentAdapter
                GameEnvironmentAdapter.addSecondPlayer(gameEnv, player2Id, player1DeckData, player2DeckData);
                
                // Initialize complete game environment (MISSING FUNCTIONALITY RESTORED)
                await GameEnvironmentAdapter.initializeGameEnvironment(gameEnv);
                
                // Update phase to REDRAW_PHASE for startReady compatibility (MISSING FUNCTIONALITY RESTORED)
                gameEnv.phase = GamePhase.REDRAW_PHASE;
                
                // Add player joined event
                gameEnv.eventManager.addEvent(EventType.PLAYER_JOINED, {
                    playerId: playerId,
                    roomStatus: GamePhase.BOTH_JOINED,
                    readyForStart: true
                });
                
                console.log(`✅ Player ${playerId} joined game ${gameId}. Game initialized and ready for start.`);
            }
            
            
            // Save updated game
            await this.saveGameToFile(gameId, gameEnv);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error joining game:', error);
            return {
                success: false,
                error: `Failed to join game: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Play a card using optimized processing with comprehensive validation
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @param cardUID - Card UID to play (e.g., "c-1_1754551822157_24")
     * @param zone - Zone to place card
     * @param faceDown - Whether to play face down
     * @returns Promise<PlayerActionResult>
     */
    async playCard(gameId: string, playerId: string, cardUID: string, zone: string, faceDown: boolean = false): Promise<PlayerActionResult> {
        try {
            console.log(`🎮 Playing card ${cardUID} in ${zone} for player ${playerId}`);
            
            // Load game environment
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            // PLACEHOLDER: Card play processing
            const result = await playCard(gameEnv, playerId, cardUID, zone as any, faceDown);
            
            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Card play failed'
                };
            }
            
            // Save updated game state (use result.gameState to ensure we save the modified state)
            const updatedGameEnv = result.gameState || gameEnv;
            await this.saveGameToFile(gameId, updatedGameEnv);
            
            console.log(`✅ Card ${cardUID} played successfully`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: updatedGameEnv,
                requiresCardSelection: result.requiresCardSelection
            };
            
        } catch (error) {
            console.error('❌ Error playing card:', error);
            return {
                success: false,
                error: `Failed to play card: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Process card selection from frontend
     * @param gameId - Game ID
     * @param playerId - Player ID making the selection
     * @param selectionId - Selection ID from pendingCardSelections
     * @param selectedCardIdentifiers - Array of selected card identifiers (supports both IDs and UIDs)
     * @returns Promise<PlayerActionResult>
     */
    async selectCard(gameId: string, playerId: string, selectionId: string, selectedCardIdentifiers: string[]): Promise<PlayerActionResult> {
        try {
            console.log(`🎯 Processing card selection for player ${playerId}: ${selectionId} with cards: ${selectedCardIdentifiers.join(', ')}`);
            
            // Load game environment
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Validate that the player exists in the game
            const player = gameEnv.getPlayer(playerId);
            if (!player) {
                return {
                    success: false,
                    error: 'Player not found in game'
                };
            }
            
            // Validate that the selection exists
            if (!gameEnv.pendingCardSelections || !gameEnv.pendingCardSelections[selectionId]) {
                return {
                    success: false,
                    error: 'Invalid or expired card selection'
                };
            }
            
            const selection = gameEnv.pendingCardSelections[selectionId];
            
            // PLACEHOLDER: Initialize game engine for card selection
            await initializeGameEngine(gameId);
            
            // PLACEHOLDER: Process card selection
            const result = await selectCard(gameEnv, selectionId, selectedCardIdentifiers);
            
            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Card selection failed'
                };
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Card selection ${selectionId} completed successfully for player ${playerId}`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error processing card selection:', error);
            return {
                success: false,
                error: `Failed to process card selection: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async getPlayerGameStateWithOutPlayer(gameId: string): Promise<GameLogicResult> {
        try {
            // Load game from file
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }    
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error getting game state:', error);
            return {
                success: false,
                error: `Failed to get game state: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Get game state for a player
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @returns Promise<GameLogicResult>
     */
    async getPlayerGameState(gameId: string, playerId: string): Promise<GameLogicResult> {
        try {
            // Load game from file
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Verify player exists in game
            const player = gameEnv.getPlayer(playerId);
            if (!player) {
                return {
                    success: false,
                    error: 'Player not found in game'
                };
            }
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error getting game state:', error);
            return {
                success: false,
                error: `Failed to get game state: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // ============ FILE OPERATIONS ============

    /**
     * Save game environment to file
     * @param gameId - Game ID
     * @param gameEnv - Game environment to save
     * @returns Promise<void>
     */
    private async saveGameToFile(gameId: string, gameEnv: GameEnvironment): Promise<void> {
        const filePath = path.join(this.baseDataPath, `${gameId}.json`);
        const gameData = gameEnv.toJSON();
        
        // Ensure directory exists
        await fs.promises.mkdir(this.baseDataPath, { recursive: true });
        
        // Save to file
        await fs.promises.writeFile(filePath, JSON.stringify(gameData, null, 2));
        console.log(`💾 Game ${gameId} saved to file`);
    }

    /**
     * Load game environment from file
     * @param gameId - Game ID
     * @returns Promise<GameEnvironment | null>
     */
    private async loadGameFromFile(gameId: string): Promise<GameEnvironment | null> {
        try {
            const filePath = path.join(this.baseDataPath, `${gameId}.json`);
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Game file not found: ${gameId}`);
                return null;
            }
            
            // Read and parse file
            const fileContent = await fs.promises.readFile(filePath, 'utf8');
            const gameData = JSON.parse(fileContent);
            
            // Convert to GameEnvironment class
            const gameEnv = GameEnvironment.fromJSON(gameData);
            
            console.log(`📂 Game ${gameId} loaded from file`);
            return gameEnv;
            
        } catch (error) {
            console.error(`❌ Error loading game ${gameId}:`, error);
            return null;
        }
    }

    /**
     * Handle player ready status with optional hand redraw
     * FIXED: Proper phase flow without premature DRAW_PHASE_COMPLETE events
     * @param gameId - Game ID
     * @param playerId - Player ID marking ready
     * @param isRedraw - Whether player wants to redraw their hand
     * @returns Promise<GameLogicResult>
     */
    async startReady(gameId: string, playerId: string, isRedraw: boolean): Promise<GameLogicResult> {
        try {
            console.log(`🎮 Player ${playerId} marking ready, redraw: ${isRedraw}`);
            
            // Load game environment
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Check if room is in correct state
            if (gameEnv.phase !== GamePhase.REDRAW_PHASE) {
                return {
                    success: false,
                    error: `Room is not ready for player ready status. Current phase: ${gameEnv.phase}`
                };
            }
            
            // STEP 1: Process individual player redraw and mark them as ready
            await gameEnv.processPlayerRedraw(playerId, isRedraw);
            gameEnv.setPlayerReady(playerId, true);
            
            console.log(`✅ Player ${playerId} marked ready (redraw: ${isRedraw})`);
            
            // STEP 2: Check if both players are ready
            const playerList = [gameEnv.playerId_1, gameEnv.playerId_2].filter(id => id);
            const bothReady = gameEnv.areAllPlayersReady();
            
            if (bothReady) {
                console.log("🎯 Both players ready - starting game initialization");
                
                // Initialize player game state without resetting fieldEffects (preserve from joinRoom)
                for (let pid of playerList) {
                    if (!pid) continue;
                    const player = gameEnv.getPlayer(pid);
                    if (!player) continue;
                    
                    // Initialize game state only, preserving existing fieldEffects from joinRoom
                    player.initializeGameStateOnly();
                }
                
                // PLACEHOLDER: Initialize game engine for game start
                await initializeGameEngine(gameId);
                await initializeGame(gameEnv);
                
                // RESTORED ORIGINAL FLOW: Transition to DRAW_PHASE and immediately execute draw
                updatePhase(gameEnv, GamePhase.DRAW_PHASE);
                gameEnv.gameStarted = true;
                
                // Set current player to first player using class properties
                gameEnv.currentPlayer = playerList[gameEnv.firstPlayer];
                gameEnv.currentTurn = 0;
                
                // Add game start event - frontend will see DRAW_PHASE started
                gameEnv.eventManager.addEvent(EventType.GAME_PHASE_START, {
                    phase: GamePhase.DRAW_PHASE,
                    currentPlayer: gameEnv.currentPlayer,
                    message: 'Both players ready - draw phase started!'
                });
                
                // RESTORED: Execute draw immediately when both players are ready
                console.log(`🎯 Executing immediate draw for current player: ${gameEnv.currentPlayer}`);
                const drawSuccess = drawCardForCurrentPlayer(gameEnv);
                
                if (drawSuccess) {
                    console.log(`✅ Draw executed successfully for player ${gameEnv.currentPlayer}`);
                    // Event already generated by drawCardForCurrentPlayer function - no duplicate needed
                } else {
                    console.log(`❌ Draw failed for player ${gameEnv.currentPlayer}`);
                    this.mozGamePlay.addGameEvent(gameEnv, EventType.ERROR_OCCURRED, {
                        message: 'Failed to draw card for current player',
                        currentPlayer: gameEnv.currentPlayer
                    });
                }
                
                console.log(`✅ Game ${gameId} started successfully with immediate draw - first player: ${gameEnv.currentPlayer}`);
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error in startReady:', error);
            return {
                success: false,
                error: `Failed to start ready: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Acknowledge game events and handle phase transitions
     * @param gameId - Game ID
     * @param eventIds - Array of event IDs to acknowledge
     * @returns Promise<GameLogicResult>
     */
    async acknowledgeEvents(gameId: string, eventIds: string[]): Promise<GameLogicResult> {
        try {
            console.log(`🔔 Acknowledging ${eventIds.length} events for game ${gameId}`);
            
            // Load game environment
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Check if we're acknowledging any DRAW_PHASE_COMPLETE events
            const allEvents = gameEnv.eventManager.getEvents();
            const drawPhaseCompleteEvents = allEvents.filter(event => 
                eventIds.includes(event.id) && event.type === EventType.DRAW_PHASE_COMPLETE
            );
            
            // Acknowledge the events using EventManager method
            gameEnv.eventManager.acknowledgeEvents(eventIds);
            
            // IMPORTANT: Phase transition logic when acknowledging DRAW_PHASE_COMPLETE
            if (drawPhaseCompleteEvents.length > 0 && gameEnv.phase === GamePhase.DRAW_PHASE) {
                console.log(`🎯 Acknowledging DRAW_PHASE_COMPLETE events - transitioning to MAIN_PHASE`);
                gameEnv.updatePhase(GamePhase.MAIN_PHASE);
                
                // Add phase transition event
                gameEnv.eventManager.addEvent(EventType.PHASE_CHANGE, {
                    oldPhase: GamePhase.DRAW_PHASE,
                    newPhase: GamePhase.MAIN_PHASE,
                    reason: 'DRAW_PHASE_COMPLETE acknowledged',
                    timestamp: Date.now()
                });
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Events acknowledged successfully for game ${gameId}`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error acknowledging events:', error);
            return {
                success: false,
                error: `Failed to acknowledge events: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Inject a complete game state for testing purposes
     * @param gameId - Game ID to inject state into
     * @param gameEnv - Complete game environment to inject
     * @returns Promise<GameLogicResult>
     */
    async injectGameState(gameId: string, gameEnv: any): Promise<GameLogicResult> {
        try {
            console.log(`🧪 Injecting game state for testing: ${gameId}`);
            
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'No game environment provided for injection'
                };
            }
            
            // Convert plain object to GameEnvironment instance if needed
            let gameEnvironment: GameEnvironment;
            if (gameEnv instanceof GameEnvironment) {
                gameEnvironment = gameEnv;
            } else {
                // Create GameEnvironment from JSON data
                gameEnvironment = GameEnvironment.fromJSON(gameEnv);
            }
            
            // Save the injected game state
            await this.saveGameToFile(gameId, gameEnvironment);
            
            console.log(`✅ Game state injected successfully: ${gameId}`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnvironment
            };
            
        } catch (error) {
            console.error('❌ Error injecting game state:', error);
            return {
                success: false,
                error: `Failed to inject game state: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }


}

// ============ EXPORT SINGLETON ============

// Create singleton instance for backward compatibility
export const gameLogic = new GameLogic();
export default gameLogic;