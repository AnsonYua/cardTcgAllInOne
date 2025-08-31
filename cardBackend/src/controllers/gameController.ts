// src/controllers/gameController.ts
// PLACEHOLDER - Custom Trading Card Game Controller

import { Request, Response } from 'express';
import { gameLogic, GameLogic } from '../services/GameLogic';
import { GamePhase } from '../models/GameEnums';
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
     * Process player action (play cards)
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
            
            // Handle PlayCard actions for custom trading card game
            if (action.type === 'PlayCard') {
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
                
                // TODO: Add validation for your custom zone types (slot1-slot6, base)
                const validZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'base'];
                if (!validZones.includes(zone)) {
                    console.log(`🚧 [PLACEHOLDER] Zone validation not fully implemented. Received zone: ${zone}`);
                    // For now, allow any zone for testing purposes
                }
                
                //     });
                //     
                //     // Check for triggered effects from card entering play
                //     if (eventResult.triggeredEffects?.length > 0) {
                //         console.log('🎯 Triggered effects detected:', eventResult.triggeredEffects);
                //         // Process each triggered effect through the trigger engine
                //         for (const trigger of eventResult.triggeredEffects) {
                //             await gameEnv.eventProcessor.getTriggerEngine()?.processTrigger(trigger);
                //         }
                //     }
                //     
                //     console.log('🎮 Event queue processed card play with triggers:', eventResult);
                // }
                
                const result = await this.gameLogic.playCard(
                    gameId, 
                    playerId, 
                    cardUID,
                    zone,
                    action.faceDown || false
                );
                
                if (result.success && result.gameEnv) {
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
                // TODO: Add support for other custom action types
                console.log(`🚧 [PLACEHOLDER] Action type '${action.type}' not implemented`);
                res.status(400).json({
                    error: `Action type '${action.type}' not implemented. Add support for your custom trading card game actions.`,
                    timestamp: new Date().toISOString(),
                    context: 'playerAction endpoint - unsupported action type'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in playerAction:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'playerAction endpoint'
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
}

// ============ EXPORT SINGLETON ============

// Create singleton instance for your custom trading card game
export const gameController = new GameController();
export default gameController;