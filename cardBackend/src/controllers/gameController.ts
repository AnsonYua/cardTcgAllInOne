// src/controllers/gameController.ts

import { Request, Response } from 'express';
import { gameLogic, GameLogic } from '../services/GameLogic';
import { GamePhase, EventType } from '../models/GameEnvironment';
import DeckManager from '../services/DeckManager';
import * as fs from 'fs';
import * as path from 'path';

// ============ TYPE DEFINITIONS ============

export interface GameRequest extends Request {
    body: {
        playerId?: string;
        playerName?: string;
        gameId?: string;
        action?: any;
        [key: string]: any;
    };
}

export interface ErrorResponse {
    error: string;
    stack?: string;
    timestamp: string;
    context?: string;
}

// ============ GAME CONTROLLER CLASS ============

export class GameController {
    private gameLogic: GameLogic;
    private deckManager: typeof DeckManager;

    constructor() {
        this.gameLogic = gameLogic;
        this.deckManager = DeckManager; // Singleton instance
        
        console.log('🎮 GameController initialized with TypeScript support');
    }

    // ============ GAME MANAGEMENT ENDPOINTS ============

    /**
     * Start a new game
     * POST /api/game/start
     */
    async startGame(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎮 Starting new game for player:', req.body.playerId);
            
            const playerId = req.body.playerId;
            if (!playerId) {
                res.status(400).json({
                    error: 'playerId is required',
                    timestamp: new Date().toISOString(),
                    context: 'startGame endpoint'
                });
                return;
            }
            
            const gameState = await this.gameLogic.createGame(playerId);
            
            if (gameState.success && gameState.gameEnv) {
                // Extract gameId to root level for API compatibility
                res.json({
                    success: true,
                    gameId: gameState.gameId,
                    gameEnv: gameState.gameEnv
                });
            } else {
                res.status(400).json({
                    error: gameState.error || 'Failed to create game',
                    timestamp: new Date().toISOString(),
                    context: 'startGame endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in startGame:', error);
            console.error('❌ Stack trace:', (error as Error).stack);
            
            const errorResponse: ErrorResponse = {
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'startGame endpoint'
            };
            
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = (error as Error).stack;
            }
            
            res.status(500).json(errorResponse);
        }
    }

    /**
     * Join an existing game
     * POST /api/game/join
     */
    async joinRoom(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🔍 joinRoom called with body:', req.body);
            
            const { gameId, playerId } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'joinRoom endpoint'
                });
                return;
            }
            
            const gameState = await this.gameLogic.joinGame(gameId, playerId);
            
            if (gameState.success && gameState.gameEnv) {
                // Extract gameId to root level for API compatibility
                res.json({
                    success: true,
                    gameId: gameState.gameId,
                    gameEnv: gameState.gameEnv
                });
            } else {
                res.status(400).json({
                    error: gameState.error || 'Failed to join game',
                    timestamp: new Date().toISOString(),
                    context: 'joinRoom endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in joinRoom:', error);
            console.error('❌ Stack trace:', (error as Error).stack);
            console.error('❌ Request body:', req.body);
            
            const errorResponse: ErrorResponse = {
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'joinRoom endpoint'
            };
            
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = (error as Error).stack;
            }
            
            res.status(500).json(errorResponse);
        }
    }

    // ============ PLAYER DATA ENDPOINTS ============

    /**
     * Get player decks
     * GET /api/game/player/:playerId/decks
     */
    async getPlayerDecks(req: GameRequest, res: Response): Promise<void> {
        try {
            const { playerId } = req.params;
            
            if (!playerId) {
                res.status(400).json({
                    error: 'playerId is required',
                    timestamp: new Date().toISOString(),
                    context: 'getPlayerDecks endpoint'
                });
                return;
            }
            
            console.log('🔍 getPlayerDecks called for playerId:', playerId);
            
            const decks = await this.deckManager.getPlayerDecks(playerId);
            res.json(decks);
            
        } catch (error) {
            console.error('❌ Error in getPlayerDecks:', error);
            console.error('❌ Stack trace:', (error as Error).stack);
            
            const errorResponse: ErrorResponse = {
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getPlayerDecks endpoint'
            };
            
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = (error as Error).stack;
            }
            
            res.status(500).json(errorResponse);
        }
    }

    /**
     * Get player game data
     * GET /api/game/player/:playerId?gameId=...
     */
    async getPlayerData(req: GameRequest, res: Response): Promise<void> {
        try {
            const { playerId } = req.params;
            const { gameId } = req.query;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'getPlayerData endpoint'
                });
                return;
            }
            
            console.log('🔍 getPlayerData called for playerId:', playerId, 'gameId:', gameId);
            
            const gameState = await this.gameLogic.getPlayerGameState(gameId as string, playerId);
            
            if (gameState.success && gameState.gameEnv) {
                // Extract gameId to root level for API compatibility
                res.json({
                    success: true,
                    gameId: gameState.gameId,
                    gameEnv: gameState.gameEnv
                });
            } else {
                res.status(400).json({
                    error: gameState.error || 'Failed to get player data',
                    timestamp: new Date().toISOString(),
                    context: 'getPlayerData endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in getPlayerData:', error);
            console.error('❌ Stack trace:', (error as Error).stack);
            
            const errorResponse: ErrorResponse = {
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getPlayerData endpoint'
            };
            
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = (error as Error).stack;
            }
            
            res.status(500).json(errorResponse);
        }
    }

    // ============ GAME ACTION ENDPOINTS ============

    /**
     * Start ready phase
     * POST /api/game/ready
     */
    async startReady(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎮 Starting ready phase for:', req.body);
            
            const { gameId, playerId, isRedraw } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'startReady endpoint'
                });
                return;
            }
            
            // Convert isRedraw to boolean following original design
            const wantRedraw = isRedraw === true || isRedraw === 'true';
            
            console.log(`🎯 Processing startReady for player ${playerId}, redraw: ${wantRedraw}`);
            
            // Use GameLogic startReady method
            const result = await gameLogic.startReady(gameId, playerId, wantRedraw);
            
            if (result.success && result.gameEnv) {
                // Extract gameId to root level for API compatibility
                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: result.gameEnv
                });
            } else {
                res.status(400).json({
                    error: result.error || 'Failed to start ready phase',
                    timestamp: new Date().toISOString(),
                    context: 'startReady endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in startReady:', error);
            console.error('❌ Stack trace:', (error as Error).stack);
            
            const errorResponse: ErrorResponse = {
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'startReady endpoint'
            };
            
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = (error as Error).stack;
            }
            
            res.status(500).json(errorResponse);
        }
    }


    /**
     * Process player action
     * POST /api/game/action
     */
    async playerAction(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎮 Processing player action:', req.body);
            
            const { gameId, playerId, action } = req.body;
            
            if (!gameId || !playerId || !action) {
                res.status(400).json({
                    error: 'gameId, playerId, and action are required',
                    timestamp: new Date().toISOString(),
                    context: 'playerAction endpoint'
                });
                return;
            }
            
            // Use modern TypeScript method for card play actions
            if (action.type === 'PlayCard') {
                // Require both cardUID and zone - no legacy fallbacks
                const cardUID = action.cardUID;
                const zone = action.zone;
                
                if (!cardUID || !zone) {
                    res.status(400).json({
                        error: 'Both cardUID and zone are required for PlayCard action',
                        timestamp: new Date().toISOString(),
                        context: 'playerAction endpoint - PlayCard validation'
                    });
                    return;
                }
                
                const result = await this.gameLogic.playCard(
                    gameId, 
                    playerId, 
                    cardUID,
                    zone,
                    action.faceDown || false
                );
                
                if (result.success && result.gameEnv) {
                    // Extract gameId to root level for API compatibility
                    res.json({
                        success: true,
                        gameId: result.gameId,
                        gameEnv: result.gameEnv,
                        requiresCardSelection: result.requiresCardSelection
                    });
                } else {
                    res.status(400).json({
                        error: result.error,
                        timestamp: new Date().toISOString(),
                        context: 'playerAction endpoint'
                    });
                }
            } else {
                // Reject unsupported action types
                res.status(400).json({
                    error: `Unsupported action type: ${action.type}. Only 'PlayCard' actions are supported through this endpoint.`,
                    timestamp: new Date().toISOString(),
                    context: 'playerAction endpoint - unsupported action type'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in playerAction:', error);
            
            const errorResponse: ErrorResponse = {
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'playerAction endpoint'
            };
            
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = (error as Error).stack;
            }
            
            res.status(500).json(errorResponse);
        }
    }

    /**
     * Process card selection from frontend
     * POST /api/game/player/selectCard
     */
    async selectCard(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎯 Processing card selection:', req.body);
            
            const { gameId, playerId, selectionId, selectedCardUIds } = req.body;
            
            // Use selectedCardUIds (unified UID-based system)
            const selectedCardIdentifiers = selectedCardUIds;
            
            if (!gameId || !playerId || !selectionId || !selectedCardIdentifiers) {
                res.status(400).json({
                    error: 'Missing required parameters: gameId, playerId, selectionId, and selectedCardUIds',
                    timestamp: new Date().toISOString(),
                    context: 'selectCard endpoint'
                });
                return;
            }
            
            // Validate selectedCardIdentifiers is an array
            if (!Array.isArray(selectedCardIdentifiers)) {
                res.status(400).json({
                    error: 'selectedCardUIds must be an array',
                    timestamp: new Date().toISOString(),
                    context: 'selectCard endpoint - validation'
                });
                return;
            }
            
            console.log(`🎯 Processing selection ${selectionId} for player ${playerId} with cards: ${selectedCardIdentifiers.join(', ')}`);
            
            // Process card selection through GameLogic
            const result = await this.gameLogic.selectCard(gameId, playerId, selectionId, selectedCardIdentifiers);
            
            if (result.success && result.gameEnv) {
                // Extract gameId to root level for API compatibility
                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: result.gameEnv
                });
            } else {
                res.status(400).json({
                    error: result.error || 'Card selection failed',
                    timestamp: new Date().toISOString(),
                    context: 'selectCard endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in selectCard:', error);
            console.error('❌ Stack trace:', (error as Error).stack);
            
            const errorResponse: ErrorResponse = {
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'selectCard endpoint'
            };
            
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = (error as Error).stack;
            }
            
            res.status(500).json(errorResponse);
        }
    }

    // ============ UTILITY METHODS ============

    /**
     * Map field index to zone type for backward compatibility with field_idx parameter
     */
    private mapFieldIndexToZone(fieldIndex?: number): string {
        const zoneMap: { [key: number]: string } = {
            1: 'LEFT',
            2: 'TOP',
            3: 'RIGHT',
            4: 'HELP',
            5: 'SP'
        };
        
        return fieldIndex ? (zoneMap[fieldIndex] || 'LEFT') : 'LEFT';
    }

    // ============ EVENT MANAGEMENT ENDPOINTS ============

    /**
     * Acknowledge events endpoint
     * POST /api/game/player/acknowledgeEvents
     */
    async acknowledgeEvents(req: Request, res: Response): Promise<void> {
        try {
            const { gameId, eventIds } = req.body;
            
            if (!gameId || !eventIds || !Array.isArray(eventIds)) {
                res.status(400).json({
                    error: 'Missing required parameters: gameId and eventIds array',
                    timestamp: new Date().toISOString(),
                    context: 'acknowledgeEvents endpoint'
                });
                return;
            }
            
            console.log(`🔔 Acknowledging ${eventIds.length} events for game ${gameId}`);
            
            // Use GameLogic service method for business logic
            const result = await this.gameLogic.acknowledgeEvents(gameId, eventIds);
            
            if (!result.success) {
                res.status(404).json({
                    error: result.error || 'Failed to acknowledge events',
                    timestamp: new Date().toISOString(),
                    context: 'acknowledgeEvents endpoint'
                });
                return;
            }
            
            console.log(`✅ Events acknowledged successfully for game ${gameId}`);
            
            res.json({
                success: true,
                gameId: result.gameId,
                acknowledgedEvents: eventIds.length,
                message: 'Events acknowledged successfully',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error acknowledging events:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'acknowledgeEvents endpoint'
            });
        }
    }

    // ============ TEST ENDPOINTS ============

    /**
     * Get test scenario for testing
     * GET /api/game/test/getTestScenario?scenarioPath=...
     */
    async getTestScenario(req: Request, res: Response): Promise<void> {
        try {
            const { scenarioPath } = req.query;
            
            if (!scenarioPath || typeof scenarioPath !== 'string') {
                res.status(400).json({
                    error: 'Missing required parameter: scenarioPath',
                    timestamp: new Date().toISOString(),
                    context: 'getTestScenario endpoint'
                });
                return;
            }
            
            console.log(`📋 Loading test scenario: ${scenarioPath}`);
            
            // Build the full path to the test scenario
            const scenarioFilePath = path.join(__dirname, '../../../shared/testScenarios/gameStates', scenarioPath + '.json');
            
            // Check if file exists
            if (!fs.existsSync(scenarioFilePath)) {
                res.status(404).json({
                    error: `Test scenario not found: ${scenarioPath}`,
                    timestamp: new Date().toISOString(),
                    context: 'getTestScenario endpoint'
                });
                return;
            }
            
            // Read and parse the scenario file
            const scenarioContent = await fs.promises.readFile(scenarioFilePath, 'utf8');
            const scenario = JSON.parse(scenarioContent);
            
            console.log(`✅ Test scenario loaded successfully: ${scenarioPath}`);
            
            res.json({
                success: true,
                scenarioPath: scenarioPath,
                scenario: scenario,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in getTestScenario:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getTestScenario endpoint'
            });
        }
    }

    /**
     * Inject game state for testing
     * POST /api/game/test/injectGameState
     */
    async injectGameState(req: Request, res: Response): Promise<void> {
        try {
            const { gameId, gameEnv } = req.body;
            
            if (!gameId || !gameEnv) {
                res.status(400).json({
                    error: 'Missing required parameters: gameId and gameEnv',
                    timestamp: new Date().toISOString(),
                    context: 'injectGameState endpoint'
                });
                return;
            }
            
            console.log(`🧪 Injecting game state for testing: ${gameId}`);
            
            // Use GameLogic service method for business logic
            const result = await this.gameLogic.injectGameState(gameId, gameEnv);
            
            if (!result.success) {
                res.status(400).json({
                    error: result.error || 'Failed to inject game state',
                    timestamp: new Date().toISOString(),
                    context: 'injectGameState endpoint'
                });
                return;
            }
            
            console.log(`✅ Game state injected successfully: ${gameId}`);
            
            res.json({
                success: true,
                gameId: result.gameId,
                message: 'Game state injected successfully',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in injectGameState:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'injectGameState endpoint'
            });
        }
    }

    // ============ HEALTH CHECK ENDPOINTS ============

    /**
     * Health check endpoint
     * GET /api/game/health
     */
    async healthCheck(req: Request, res: Response): Promise<void> {
        try {
            const status = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    gameLogic: 'available',
                    deckManager: this.deckManager.isInitialized() ? 'initialized' : 'not initialized'
                }
            };
            
            res.json(status);
            
        } catch (error) {
            console.error('❌ Error in health check:', error);
            res.status(500).json({
                status: 'unhealthy',
                error: (error as Error).message,
                timestamp: new Date().toISOString()
            });
        }
    }
}

// ============ EXPORT SINGLETON ============

// Create singleton instance for backward compatibility
export const gameController = new GameController();
export default gameController;