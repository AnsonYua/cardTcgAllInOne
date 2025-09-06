// src/controllers/gameController.ts
// PLACEHOLDER - Custom Trading Card Game Controller

import { Request, Response } from 'express';
import { gameLogic, GameLogic } from '../services/GameLogic';
import { GamePhase, PlayerActionType, CardPlayType } from '../models/GameEnums';
import { PlayerAction } from '../services/EventQueue/EventManager';
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

// ============ CUSTOM TRADING CARD GAME CONTROLLER ============

export class GameController {
    private gameLogic: GameLogic;

    constructor() {
        this.gameLogic = gameLogic;
        console.log('🎮 Custom Trading Card Game Controller initialized');
    }

    // ============ CORE GAME ENDPOINTS ============

    /**
     * Start a new custom trading card game
     * POST /api/game/start
     */
    async startGame(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎮 Starting new custom trading card game for player:', req.body.playerId);
            
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
                // TODO: Initialize event queue system for this game
                // gameState.gameEnv.initializeEventProcessor();
                // console.log('🎮 Event queue system initialized for game:', gameState.gameId);
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
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'startGame endpoint'
            });
        }
    }

    /**
     * Join an existing custom trading card game
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
                // TODO: Initialize event queue when second player joins  
                // if (gameState.gameEnv.playerId_2) {
                //     gameState.gameEnv.initializeEventProcessor();
                //     await this.gameLogic.registerCardTriggersForGame(gameState.gameEnv);
                //     console.log('🎮 Event queue system activated with card triggers for full game:', gameId);
                // }
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
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'joinRoom endpoint'
            });
        }
    }

    /**
     * Start ready phase for a player
     * POST /api/game/player/startReady
     */
    async startReady(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🔍 startReady called with body:', req.body);
            
            const { gameId, playerId, isRedraw } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'startReady endpoint'
                });
                return;
            }
            
            const gameState = await this.gameLogic.startReady(gameId, playerId, isRedraw || false);
            
            if (gameState.success && gameState.gameEnv) {
                res.json({
                    success: true,
                    gameId: gameState.gameId,
                    gameEnv: gameState.gameEnv
                });
            } else {
                res.status(400).json({
                    error: gameState.error || 'Failed to start ready phase',
                    timestamp: new Date().toISOString(),
                    context: 'startReady endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in startReady:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'startReady endpoint'
            });
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
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getPlayerData endpoint'
            });
        }
    }

    /**
     * Process player action with card auto-discovery from zones
     * POST /api/game/player/playCard
     * Body: { gameId, playerId, cardUID } or { gameId, playerId, action }
     */
    async playCard(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎮 Processing player action:', req.body);
            
            const { gameId, playerId, cardUID, action } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'playCard endpoint'
                });
                return;
            }
            
            // Handle structured actions only  
            if (action) {
                console.log('🎯 Processing structured action:', action);
                
                // Handle PlayCard actions with playAs specification
                if (action.type === 'PlayCard' && action.cardUID && action.playAs) {
                    const cardUID = action.cardUID;
                    const playAs = action.playAs;
                    const targetUnit = action.targetUnit; // Extract targetUnit if provided
                    
                    // Validate playAs value using enum
                    const validPlayAsValues = Object.values(CardPlayType);
                    if (!validPlayAsValues.includes(playAs as CardPlayType)) {
                        res.status(400).json({
                            error: `Invalid playAs value: ${playAs}. Must be one of: ${validPlayAsValues.join(', ')}`,
                            timestamp: new Date().toISOString(),
                            context: 'playCard endpoint - playAs validation'
                        });
                        return;
                    }
                    
                    // Validate targetUnit requirement for pilot cards
                    if (playAs === CardPlayType.PILOT && !targetUnit) {
                        res.status(400).json({
                            error: 'targetUnit is required when playing a card as pilot',
                            message: 'Pilot cards must specify which unit they are being attached to via the targetUnit parameter',
                            timestamp: new Date().toISOString(),
                            context: 'playCard endpoint - pilot targetUnit validation'
                        });
                        return;
                    }
                    
                    console.log(`🎯 Playing card ${cardUID} as ${playAs}${targetUnit ? ` targeting ${targetUnit}` : ''}`);
                    
                    // Pass action object directly to avoid parameter unpacking/repacking
                    const result = await this.gameLogic.playCardWithAction(gameId, playerId, action);
                    
                    if (result.success && result.gameEnv) {
                        res.json({
                            success: true,
                            gameId: result.gameId,
                            gameEnv: result.gameEnv
                        });
                    } else {
                        res.status(400).json({
                            error: result.error,
                            timestamp: new Date().toISOString(),
                            context: 'playCard endpoint'
                        });
                    }
                    return;
                }
                
                // Handle missing required fields for PlayCard action
                if (action.type === 'PlayCard') {
                    const missingFields = [];
                    if (!action.cardUID) missingFields.push('cardUID');
                    if (!action.playAs) missingFields.push('playAs');
                    
                    res.status(400).json({
                        error: `PlayCard action missing required fields: ${missingFields.join(', ')}`,
                        message: 'PlayCard action requires both cardUID and playAs parameters',
                        timestamp: new Date().toISOString(),
                        context: 'playCard endpoint - PlayCard validation'
                    });
                    return;
                }
                
                // Handle other structured actions (card selection, effects, etc.)
                res.status(501).json({
                    error: 'Structured action type not yet implemented: ' + action.type,
                    message: 'Currently supports PlayCard actions. Other action types coming soon.',
                    timestamp: new Date().toISOString(),
                    context: 'playCard endpoint'
                });
                return;
            }
            
            // No action provided
            res.status(400).json({
                error: 'Action parameter is required',
                timestamp: new Date().toISOString(),
                context: 'playCard endpoint'
            });
            
        } catch (error) {
            console.error('❌ Error in playCard:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'playCard endpoint'
            });
        }
    }

    /**
     * End current player's turn and advance game state
     * POST /api/game/player/endTurn
     */
    async endTurn(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🏁 endTurn called with body:', req.body);
            
            const { gameId, playerId } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'endTurn endpoint'
                });
                return;
            }
            
            // Load game state
            const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
            if (!gameEnv) {
                res.status(404).json({
                    error: 'Game not found',
                    gameId,
                    timestamp: new Date().toISOString(),
                    context: 'endTurn endpoint'
                });
                return;
            }
            
            // Validate it's the player's turn
            if (gameEnv.currentPlayer !== playerId) {
                res.status(400).json({
                    error: `Not your turn. Current player is: ${gameEnv.currentPlayer}`,
                    timestamp: new Date().toISOString(),
                    context: 'endTurn endpoint'
                });
                return;
            }
            
            console.log(`🎯 Processing end turn for player: ${playerId}, current turn: ${gameEnv.currentTurn}`);
            
            // Process END_TURN through centralized action processing
            const endTurnAction: PlayerAction = {
                type: PlayerActionType.END_TURN,
                playerId,
                gameId,
                currentTurn: gameEnv.currentTurn
            };
            
            const actionResult = await this.gameLogic.processAction(gameEnv, endTurnAction);
            console.log('🎮 END_TURN processed:', actionResult);
            
            if (!actionResult.success) {
                res.status(400).json({
                    error: actionResult.error || 'Failed to end turn',
                    timestamp: new Date().toISOString(),
                    context: 'endTurn endpoint'
                });
                return;
            }
            
            // Save updated game state
            await this.gameLogic.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ End turn processed successfully for ${playerId}`);
            res.json({
                success: true,
                gameEnv: gameEnv,
                message: `Turn ended for ${playerId}`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in endTurn:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'endTurn endpoint'
            });
        }
    }

    // ============ CARD DATA ENDPOINTS ============

    /**
     * Get custom card data (st01Card.json)
     * GET /api/game/cards
     */
    async getCardData(req: Request, res: Response): Promise<void> {
        try {
            console.log('📋 Getting custom card data (st01Card.json)');
            
            // Build path to st01Card.json
            const cardDataPath = path.join(__dirname, '../data/st01Card.json');
            
            // Check if file exists
            if (!fs.existsSync(cardDataPath)) {
                res.status(404).json({
                    error: 'Custom card data file not found (st01Card.json)',
                    timestamp: new Date().toISOString(),
                    context: 'getCardData endpoint'
                });
                return;
            }
            
            // Read and parse the st01Card.json file
            const cardDataContent = await fs.promises.readFile(cardDataPath, 'utf8');
            const cardData = JSON.parse(cardDataContent);
            
            console.log('✅ Custom card data loaded successfully');
            
            res.json(cardData);
            
        } catch (error) {
            console.error('❌ Error in getCardData:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getCardData endpoint'
            });
        }
    }

    /**
     * Get game resource data (deck data for frontend card preloading)
     * GET /api/game/player/gameResource
     */
    async getGameResource(req: Request, res: Response): Promise<void> {
        try {
            console.log('📦 Getting game resource data (deck data)');
            
            // Build path to gcgdecks.json
            const deckDataPath = path.join(__dirname, '../data/gcgdecks.json');
            
            // Check if file exists
            if (!fs.existsSync(deckDataPath)) {
                res.status(404).json({
                    error: 'Deck data file not found (gcgdecks.json)',
                    timestamp: new Date().toISOString(),
                    context: 'getGameResource endpoint'
                });
                return;
            }
            
            // Read and parse the gcgdecks.json file
            const deckDataContent = await fs.promises.readFile(deckDataPath, 'utf8');
            const deckData = JSON.parse(deckDataContent);
            
            console.log('✅ Game resource data loaded successfully');
            
            res.json(deckData);
            
        } catch (error) {
            console.error('❌ Error in getGameResource:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getGameResource endpoint'
            });
        }
    }

    // ============ IMAGE SERVING ENDPOINTS ============

    /**
     * Serve images from data/image folder
     * GET /api/game/image/*
     */
    async serveImage(req: Request, res: Response): Promise<void> {
        try {
            // Get the full path from the wildcard route
            const imagePath_requested = req.params[0];
            
            if (!imagePath_requested) {
                res.status(400).json({
                    error: 'Image path is required',
                    timestamp: new Date().toISOString(),
                    context: 'serveImage endpoint'
                });
                return;
            }
            
            console.log(`🖼️ Serving image: ${imagePath_requested}`);
            
            // Sanitize the path to prevent directory traversal attacks
            const sanitizedImagePath = imagePath_requested
                .replace(/\.\./g, '')  // Remove ..
                .replace(/[\\]/g, '/') // Normalize path separators
                .replace(/\/+/g, '/'); // Remove double slashes
            
            // Build full path to image file
            const imagePath = path.join(__dirname, '../data/image', sanitizedImagePath);
            
            // Check if file exists
            if (!fs.existsSync(imagePath)) {
                res.status(404).json({
                    error: `Image not found: ${sanitizedImagePath}`,
                    timestamp: new Date().toISOString(),
                    context: 'serveImage endpoint'
                });
                return;
            }
            
            // Get file extension to set proper Content-Type
            const ext = path.extname(sanitizedImagePath).toLowerCase();
            let contentType = 'application/octet-stream';
            
            switch (ext) {
                case '.png':
                    contentType = 'image/png';
                    break;
                case '.jpg':
                case '.jpeg':
                    contentType = 'image/jpeg';
                    break;
                case '.gif':
                    contentType = 'image/gif';
                    break;
                case '.webp':
                    contentType = 'image/webp';
                    break;
                case '.svg':
                    contentType = 'image/svg+xml';
                    break;
            }
            
            // Set appropriate headers for image serving
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            
            // Serve the image file
            res.sendFile(imagePath, (err) => {
                if (err) {
                    console.error('❌ Error serving image:', err);
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'Failed to serve image',
                            timestamp: new Date().toISOString(),
                            context: 'serveImage endpoint'
                        });
                    }
                } else {
                    console.log(`✅ Image served successfully: ${sanitizedImagePath}`);
                }
            });
            
        } catch (error) {
            console.error('❌ Error in serveImage:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'serveImage endpoint'
            });
        }
    }

    // ============ EVENT QUEUE ENDPOINTS ============

    /**
     * Test event queue functionality
     * POST /api/game/test-events
     */
    async testEventQueue(req: GameRequest, res: Response): Promise<void> {
        try {
            const { gameId } = req.body;
            
            if (!gameId) {
                res.status(400).json({
                    error: 'gameId is required',
                    timestamp: new Date().toISOString(),
                    context: 'testEventQueue endpoint'
                });
                return;
            }
            
            // TODO: Load game and test event queue
            // const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
            // if (!gameEnv) {
            //     res.status(404).json({ error: 'Game not found' });
            //     return;
            // }
            // 
            // gameEnv.initializeEventProcessor();
            // const processor = gameEnv.getEventProcessor();
            // const queueStatus = processor?.getQueueStatus();
            // 
            // res.json({
            //     success: true,
            //     gameId,
            //     eventQueueStatus: queueStatus,
            //     message: 'Event queue system tested successfully'
            // });
            
            res.json({
                success: true,
                gameId,
                message: 'Event queue test endpoint - implementation needed'
            });
            
        } catch (error) {
            console.error('❌ Error testing event queue:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'testEventQueue endpoint'
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
                    customTradingCardGame: 'ready for development'
                },
                message: 'Custom Trading Card Game API is ready'
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



}

// ============ EXPORT SINGLETON ============

// Create singleton instance for your custom trading card game
export const gameController = new GameController();
export default gameController;