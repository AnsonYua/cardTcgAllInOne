// src/routes/gameRoutes.ts

import express, { Request, Response, NextFunction } from 'express';
import { gameController, GameController } from '../controllers/gameController';
import DeckManager from '../services/DeckManager';

// ============ TYPE DEFINITIONS ============

export interface RouteHandler {
    (req: Request, res: Response, next?: NextFunction): Promise<void> | void;
}

// ============ ROUTER SETUP ============

const router = express.Router();

// ============ HEALTH CHECK ENDPOINTS ============

/**
 * Health check endpoint
 * GET /api/game/health
 */
router.get('/health', gameController.healthCheck.bind(gameController));

// Alternative simple health check for legacy compatibility
router.get('/status', (req: Request, res: Response) => {
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'cardBackend'
    });
});

// ============ PLAYER DATA ENDPOINTS ============

/**
 * Get player game data
 * GET /api/game/player/:playerId?gameId=...
 */
router.get('/player/:playerId', gameController.getPlayerData.bind(gameController));

/**
 * Get player decks (legacy endpoint)
 * POST /api/game/player/:playerId/deck
 */
router.post('/player/:playerId/deck', gameController.getPlayerDecks.bind(gameController));

/**
 * Update player score (placeholder for future implementation)
 * PUT /api/game/player/:playerId/score
 */
router.put('/player/:playerId/score', async (req: Request, res: Response) => {
    // TODO: Implement score updating when needed
    res.status(501).json({
        error: 'Score updating not yet implemented',
        timestamp: new Date().toISOString()
    });
});

// ============ GAME MANAGEMENT ENDPOINTS ============

/**
 * Start a new game
 * POST /api/game/player/startGame
 */
router.post('/player/startGame', gameController.startGame.bind(gameController));

/**
 * Join an existing game
 * POST /api/game/player/joinRoom
 */
router.post('/player/joinRoom', gameController.joinRoom.bind(gameController));

/**
 * Start ready phase
 * POST /api/game/player/startReady
 */
router.post('/player/startReady', gameController.startReady.bind(gameController));


// ============ GAME ACTION ENDPOINTS ============

/**
 * Process player action
 * POST /api/game/player/playerAction
 */
router.post('/player/playerAction', gameController.playerAction.bind(gameController));

/**
 * Process AI player action (placeholder)
 * POST /api/game/player/playerAiAction
 */
router.post('/player/playerAiAction', async (req: Request, res: Response) => {
    // TODO: Implement AI actions when needed
    res.status(501).json({
        error: 'AI actions not yet implemented',
        timestamp: new Date().toISOString()
    });
});

/**
 * Select card (card selection workflows)
 * POST /api/game/player/selectCard
 */
router.post('/player/selectCard', gameController.selectCard.bind(gameController));

/**
 * Acknowledge events
 * POST /api/game/player/acknowledgeEvents
 */
router.post('/player/acknowledgeEvents', gameController.acknowledgeEvents.bind(gameController));

/**
 * Next round
 * POST /api/game/player/nextRound
 */
router.post('/player/nextRound', async (req: Request, res: Response) => {
    // TODO: Implement next round logic when needed
    res.status(501).json({
        error: 'Next round logic not yet implemented',
        timestamp: new Date().toISOString()
    });
});

// ============ TEST ENDPOINTS ============

/**
 * Set test case
 * POST /api/game/test/setCase
 */
router.post('/test/setCase', async (req: Request, res: Response) => {
    try {
        if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
            res.status(403).json({ 
                error: 'Test endpoints only available in test/development environment',
                timestamp: new Date().toISOString()
            });
            return;
        }
        
        // TODO: Implement test case setup when needed
        res.json({
            success: true,
            message: 'Test case setup (not implemented)',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            error: (error as Error).message,
            timestamp: new Date().toISOString(),
            context: 'setCase endpoint'
        });
    }
});

/**
 * Get test scenario
 * GET /api/game/test/getTestScenario?scenarioPath=...
 */
router.get('/test/getTestScenario', 
    // Environment check middleware
    (req: Request, res: Response, next: NextFunction) => {
        // Allow in development for now, restrict in production
        if (process.env.NODE_ENV === 'production') {
            res.status(403).json({ 
                error: 'This endpoint is only available in test/development environment',
                timestamp: new Date().toISOString()
            });
            return;
        }
        next();
    },
    // Main handler - use controller method
    gameController.getTestScenario.bind(gameController)
);

/**
 * Inject game state for testing
 * POST /api/game/test/injectGameState
 */
router.post('/test/injectGameState', 
    // Environment check middleware
    (req: Request, res: Response, next: NextFunction) => {
        // Allow in development for now, restrict in production
        if (process.env.NODE_ENV === 'production') {
            res.status(403).json({ 
                error: 'This endpoint is only available in test/development environment',
                timestamp: new Date().toISOString()
            });
            return;
        }
        next();
    },
    // Main handler - use controller method
    gameController.injectGameState.bind(gameController)
);

// ============ ERROR HANDLING MIDDLEWARE ============

/**
 * Global error handler for game routes
 */
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Game route error:', error);
    console.error('❌ Request URL:', req.url);
    console.error('❌ Request method:', req.method);
    console.error('❌ Request body:', req.body);
    
    if (res.headersSent) {
        return next(error);
    }
    
    res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString(),
        context: 'Game routes error handler',
        path: req.url,
        method: req.method
    });
});

// ============ EXPORT ROUTER ============

export default router;