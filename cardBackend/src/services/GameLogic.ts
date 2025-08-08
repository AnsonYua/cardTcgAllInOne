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
const mozDeckHelper = require('../mozGame/mozDeckHelper');

// ============ TYPE DEFINITIONS ============

export interface GameLogicResult {
    success: boolean;
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
    
    // Add draw phase event using class event manager
    gameEnvClass.eventManager.addEvent(EventType.DRAW_PHASE_COMPLETE, {
        playerId: currentPlayerId,
        cardCount: 1,
        newHandSize: result.hand.length,
        requiresAcknowledgment: true
    }, true);
    
    // Add game start event using class event manager
    gameEnvClass.eventManager.addEvent(EventType.GAME_PHASE_START, {
        phase: GamePhase.DRAW_PHASE,
        currentPlayer: currentPlayerId,
        message: 'Both players ready - draw phase started!'
    });
    
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
        
        // IMPORTANT: Inject mozGamePlay.calculatePlayerPoint to avoid circular dependency
        effectSimulator.setCalculatePlayerPointFunction(this.mozGamePlay.calculatePlayerPoint.bind(this.mozGamePlay));
        
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
            gameEnv.gameId = gameId;
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
            
            // Set player ready status
            gameEnv.setPlayerReady(playerId, true);
            
            // Add game creation event
            gameEnv.eventManager.addEvent(EventType.GAME_CREATED, {
                gameId: gameId,
                createdBy: playerId,
                phase: gameEnv.phase,
                timestamp: Date.now()
            });
            
            // Save game to file system
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Game created successfully: ${gameId}`);
            
            return {
                success: true,
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
     * Join an existing game
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
            
            // Check if game is full
            if (gameEnv.playerId_2 && gameEnv.playerId_2 !== playerId) {
                return {
                    success: false,
                    error: 'Game is full'
                };
            }
            
            // Add second player
            if (!gameEnv.playerId_2) {
                gameEnv.playerId_2 = playerId;
                gameEnv.addPlayer(playerId, `Player 2`);
                
                // Update phase when both players join
                gameEnv.phase = GamePhase.BOTH_JOINED;
                
                // Add player join event
                gameEnv.eventManager.addEvent(EventType.PLAYER_JOINED, {
                    gameId: gameId,
                    playerId: playerId,
                    playerCount: 2,
                    phase: gameEnv.phase,
                    timestamp: Date.now()
                });
                
                console.log(`✅ Player ${playerId} joined game ${gameId}`);
            }
            
            // Set player ready
            gameEnv.setPlayerReady(playerId, true);
            
            // Save updated game
            await this.saveGameToFile(gameId, gameEnv);
            
            return {
                success: true,
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