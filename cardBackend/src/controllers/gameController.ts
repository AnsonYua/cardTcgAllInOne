// src/controllers/gameController.ts

import { Request, Response } from 'express';
import { gameLogic, GameLogic } from '../services/GameLogic';
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
            
            if (gameState.success) {
                res.json(gameState);
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
            
            if (gameState.success) {
                res.json(gameState);
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
            
            if (gameState.success) {
                res.json(gameState);
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
            
            const { gameId, playerId } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'startReady endpoint'
                });
                return;
            }
            
            // TODO: Implement startReady in new GameLogic
            res.status(501).json({
                error: 'startReady not yet implemented in TypeScript version',
                timestamp: new Date().toISOString(),
                context: 'startReady endpoint - needs implementation'
            });
            
        } catch (error) {
            console.error('❌ Error in startReady:', error);
            
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
            
            // Use new TypeScript method for card play actions
            if (action.type === 'PlayCard') {
                const result = await this.gameLogic.playCard(
                    gameId, 
                    playerId, 
                    action.cardId || action.card_idx,
                    this.mapFieldIndexToZone(action.field_idx),
                    action.faceDown || false
                );
                
                if (result.success) {
                    res.json(result);
                } else {
                    res.status(400).json({
                        error: result.error,
                        timestamp: new Date().toISOString(),
                        context: 'playerAction endpoint'
                    });
                }
            } else {
                // For other actions, use legacy method until fully migrated
                const gameState = await this.gameLogic.processPlayerAction(gameId, playerId, action);
                res.json(gameState);
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

    // ============ UTILITY METHODS ============

    /**
     * Map field index to zone type for backward compatibility
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