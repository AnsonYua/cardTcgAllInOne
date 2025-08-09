// src/services/GameLogic.ts

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Request, Response } from 'express';

// Import TypeScript modules with proper types
import { GameEnvironment, GamePhase, ActionType, ZoneType, EventType, Player } from '../models/GameEnvironment';
import { GameEnvironmentAdapter } from '../utils/GameEnvironmentAdapter';
import { effectSimulator, EffectSimulator } from './EffectSimulator';
import { optimizedGameEngineManager, OptimizedGameEngine } from './OptimizedGameEngine';

// Import JavaScript modules (will be converted later)
const mozGamePlay = require('../mozGame/mozGamePlay');
const mozAIClass = require('../mozGame/mozAIClass');
const playSequenceManager = require('./PlaySequenceManager');
const cardEffectRegistry = require('./CardEffectRegistry');

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

// Initialize OptimizedGameEngine per game - No longer singleton!
async function initializeOptimizedEngine(gameId: string): Promise<void> {
    console.log(`🚀 Initializing OptimizedGameEngine for game: ${gameId}...`);
    await optimizedGameEngineManager.initializeGameEngine(gameId);
    console.log(`✅ OptimizedGameEngine initialized for game: ${gameId}`);
}

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
    
    const hand = currentPlayer.deck.hand;
    const mainDeck = currentPlayer.deck.mainDeck;
    const result = mozDeckHelper.drawToHand(hand, mainDeck);
    
    // Update player deck
    currentPlayer.deck.hand = result.hand;
    currentPlayer.deck.mainDeck = result.mainDeck;
    
    // FIXED: Add draw phase event using class event manager
    // This should only fire AFTER the draw action completes, not during game start
    gameEnvClass.eventManager.addEvent(EventType.DRAW_PHASE_COMPLETE, {
        playerId: currentPlayerId,
        cardCount: 1,
        newHandSize: result.hand.length
    }, true);
    
    console.log(`🎯 Player ${currentPlayerId} drew 1 card. New hand size: ${result.hand.length}`);
    return true;
}

// ============ MAIN GAMELOGIC CLASS ============

export class GameLogic {
    private mozGamePlay: any;
    private baseDataPath: string;

    constructor() {
        this.mozGamePlay = mozGamePlay;
        this.baseDataPath = path.join(__dirname, '../gameData');
        
        // NEW: Initialize TypeScript effect system with dependencies
        effectSimulator.setCardInfoUtils(this.mozGamePlay.cardInfoUtils);
        
        // IMPORTANT: Inject mozGamePlay.calculatePlayerPoint to avoid circular dependency (with defensive binding)
        if (this.mozGamePlay && this.mozGamePlay.calculatePlayerPoint) {
            effectSimulator.setCalculatePlayerPointFunction(this.mozGamePlay.calculatePlayerPoint.bind(this.mozGamePlay));
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
            await initializeOptimizedEngine(gameId);
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
     * Play a card using optimized processing
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @param cardId - Card ID to play
     * @param zone - Zone to place card
     * @param faceDown - Whether to play face down
     * @returns Promise<PlayerActionResult>
     */
    async playCard(gameId: string, playerId: string, cardId: string, zone: string, faceDown: boolean = false): Promise<PlayerActionResult> {
        try {
            console.log(`🎮 Playing card ${cardId} in ${zone} for player ${playerId}`);
            
            // Load game environment
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Get optimized game engine for this game
            const gameEngine = optimizedGameEngineManager.getGameEngine(gameId);
            if (!gameEngine.isInitialized()) {
                await gameEngine.initialize();
            }
            
            // Use optimized card play processing
            const result = await gameEngine.playCard(gameEnv, playerId, cardId, zone as any, faceDown);
            
            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Card play failed'
                };
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Card ${cardId} played successfully`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv,
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
                
                // Initialize all player states using consolidated method
                for (let pid of playerList) {
                    if (!pid) continue;
                    const player = gameEnv.getPlayer(pid);
                    if (!player) continue;
                    
                    // Initialize all player state (field effects, game stats, etc.) in one call
                    player.initializeForGameStart();
                }
                
                // OPTIMIZED GAME ENGINE INITIALIZATION: Initialize for high-performance processing
                await initializeOptimizedEngine(gameId);
                const gameEngine = optimizedGameEngineManager.getGameEngine(gameId);
                await gameEngine.initializeGame(gameEnv);
                
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
                    // Generate DRAW_PHASE_COMPLETE event after draw execution
                    gameEnv.eventManager.addEvent(EventType.DRAW_PHASE_COMPLETE, {
                        phase: GamePhase.MAIN_PHASE,
                        currentPlayer: gameEnv.currentPlayer,
                        message: 'Draw completed - transitioning to main phase!'
                    });
                } else {
                    console.log(`❌ Draw failed for player ${gameEnv.currentPlayer}`);
                    gameEnv.eventManager.addEvent(EventType.ERROR_OCCURRED, {
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
            
            // CRITICAL: Initialize play sequence manager if not present
            if (!gameEnvironment.playSequenceManager) {
                console.log('🔧 Initializing missing play sequence manager');
                // Use the existing constructor logic which creates a new PlaySequenceManager
                const PlaySequenceManager = require('../services/PlaySequenceManager');
                gameEnvironment.playSequenceManager = new PlaySequenceManager();
            }
            
            // CRITICAL: Record leader plays if leaders exist in zones but not in play sequence
            const playerIds = [gameEnvironment.playerId_1, gameEnvironment.playerId_2].filter(Boolean);
            for (const playerId of playerIds as string[]) {
                const playerZones = (gameEnvironment.zones as any)[playerId];
                if (playerId && playerZones && playerZones.leader) {
                    const leaderId = playerZones.leader.id;
                    
                    // Check if this leader play is already recorded
                    const playSequenceData = gameEnvironment.playSequenceManager.toJSON();
                    const existingLeaderPlay = playSequenceData.plays.find((play: any) => 
                        play.action === 'PLAY_LEADER' && 
                        play.playerId === playerId && 
                        play.cardUid === leaderId
                    );
                    
                    if (!existingLeaderPlay) {
                        console.log(`🔧 Recording missing leader play: ${leaderId} for ${playerId}`);
                        gameEnvironment.playSequenceManager.addPlay(playerId, leaderId, 'PLAY_LEADER' as any, 'leader' as any);
                    }
                }
            }
            
            // CRITICAL: Initialize field effects if needed
            for (const playerId of playerIds as string[]) {
                const player = (gameEnvironment.players as any)[playerId];
                if (playerId && player && !player.fieldEffects) {
                    console.log(`🔧 Initializing field effects for ${playerId}`);
                    player.fieldEffects = {
                        zoneRestrictions: {},
                        activeEffects: [],
                        specialEffects: {},
                        calculatedPowers: {},
                        disabledCards: [],
                        victoryPointModifiers: 0
                    };
                }
            }
            
            // TODO: Run unified effect simulation through EffectSimulator
            // This would process all plays including leaders for complete effect simulation
            // For now, we'll save the state as-is for basic testing
            
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


    // ============ LEGACY COMPATIBILITY METHODS ============

    /**
     * Legacy method for backward compatibility
     * Processes player actions using the new TypeScript system
     */
    async processPlayerAction(gameId: string, playerId: string, action: any): Promise<PlayerActionResult> {
        try {
            // Convert legacy action to new format
            if (action.type === 'PlayCard') {
                const zoneMap: { [key: number]: string } = {
                    1: ZoneType.LEFT,
                    2: ZoneType.TOP,
                    3: ZoneType.RIGHT,
                    4: ZoneType.HELP
                };
                
                const zone = zoneMap[action.field_idx] || 'LEFT';
                const cardId = action.card_idx; // This should be the actual card ID
                
                return this.playCard(gameId, playerId, cardId, zone, false);
            }
            
            return {
                success: false,
                error: 'Unknown action type'
            };
            
        } catch (error) {
            console.error('❌ Error processing player action:', error);
            return {
                success: false,
                error: `Failed to process action: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

// ============ EXPORT SINGLETON ============

// Create singleton instance for backward compatibility
export const gameLogic = new GameLogic();
export default gameLogic;