// src/routes/gameRoutes.ts
// PLACEHOLDER - Custom Trading Card Game Routes

import express, { Request, Response, NextFunction } from 'express';
import { gameController, GameController } from '../controllers/gameController';
import { gameLogic } from '../services/GameLogic';

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

/**
 * Simple status check
 * GET /api/game/status
 */
router.get('/status', (req: Request, res: Response) => {
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Custom Trading Card Game Backend',
        message: 'Server is running and ready for your custom game logic'
    });
});

// ============ CORE GAME ENDPOINTS ============

/**
 * Start a new custom trading card game
 * POST /api/game/player/startGame
 */
router.post('/player/startGame', gameController.startGame.bind(gameController));

/**
 * Join an existing custom trading card game
 * POST /api/game/player/joinRoom
 */
router.post('/player/joinRoom', gameController.joinRoom.bind(gameController));
/**
 * Start ready phase for a player
 * POST /api/game/player/startReady
 */
router.post('/player/startReady', gameController.startReady.bind(gameController));

/**
 * Get game resource data (deck data for frontend card preloading)
 * GET /api/game/player/gameResource
 */
router.get('/player/gameResource', gameController.getGameResource.bind(gameController));

/**
 * Get player game data
 * GET /api/game/player/:playerId?gameId=...
 */
router.get('/player/:playerId', gameController.getPlayerData.bind(gameController));

/**
 * Process player action (play cards)
 * POST /api/game/player/playCard
 */
router.post('/player/playCard', gameController.playCard.bind(gameController));

/**
 * Execute player action (attacks, abilities, etc.)
 * POST /api/game/player/playerAction
 */
router.post('/player/playerAction', gameController.playerAction.bind(gameController));

/**
 * End current player's turn and advance game state
 * POST /api/game/player/endTurn
 */
router.post('/player/endTurn', gameController.endTurn.bind(gameController));

// ============ CUSTOM CARD DATA ENDPOINTS ============

/**
 * Get custom card data (st01Card.json)
 * GET /api/game/cards
 */
router.get('/cards', gameController.getCardData.bind(gameController));

// ============ IMAGE SERVING ENDPOINTS ============

/**
 * Serve images from data/image folder
 * GET /api/game/image/*
 */
router.get('/image/*', gameController.serveImage.bind(gameController));

// ============ PLACEHOLDER ENDPOINTS FOR FUTURE DEVELOPMENT ============


/**
 * Select card (placeholder for card selection workflows)
 * POST /api/game/player/selectCard
 */
router.post('/player/selectCard', async (req: Request, res: Response) => {
    console.log('🚧 [PLACEHOLDER] selectCard endpoint not implemented');
    res.status(501).json({
        error: 'Card selection not implemented for custom trading card game',
        message: 'Add your custom card selection logic here',
        timestamp: new Date().toISOString()
    });
});

/**
 * Acknowledge events
 * POST /api/game/player/acknowledgeEvents
 */
router.post('/player/acknowledgeEvents', async (req: Request, res: Response) => {
    try {
        const { gameId, playerId, eventIds } = req.body;
        
        const result = await gameLogic.acknowledgeEvents(gameId, playerId, eventIds);
        
        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            acknowledgedCount: result.acknowledgedCount,
            notificationQueue: result.gameEnv?.notificationQueue || [],
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in acknowledgeEvents:', error);
        res.status(500).json({
            error: 'Internal server error during event acknowledgment',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Confirm or decline a burst effect choice
 * POST /api/game/player/confirmBurstChoice
 */
router.post('/player/confirmBurstChoice', gameController.confirmBurstChoice.bind(gameController));

/**
 * AI player action (placeholder)
 * POST /api/game/player/playerAiAction
 */
router.post('/player/playerAiAction', async (req: Request, res: Response) => {
    console.log('🚧 [PLACEHOLDER] playerAiAction endpoint not implemented');
    res.status(501).json({
        error: 'AI actions not implemented for custom trading card game',
        message: 'Add your custom AI logic here if needed',
        timestamp: new Date().toISOString()
    });
});

/**
 * Update player score (placeholder)
 * PUT /api/game/player/:playerId/score
 */
router.put('/player/:playerId/score', async (req: Request, res: Response) => {
    console.log('🚧 [PLACEHOLDER] score update endpoint not implemented');
    res.status(501).json({
        error: 'Score updating not implemented for custom trading card game',
        message: 'Add your custom scoring system here',
        timestamp: new Date().toISOString()
    });
});

// ============ DEVELOPMENT/TESTING ENDPOINTS ============

/**
 * Get test scenario data
 * GET /api/game/test/getTestScenario?scenarioPath=simple_test
 */
router.get('/test/getTestScenario', gameController.getTestScenario.bind(gameController));

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

/**
 * Set test case (development only)
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
        
        console.log('🧪 [PLACEHOLDER] Test case setup not implemented');
        res.json({
            success: true,
            message: 'Test case setup placeholder - implement your testing logic here',
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

// ============ ERROR HANDLING MIDDLEWARE ============

/**
 * Global error handler for game routes
 */
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Custom trading card game route error:', error);
    console.error('❌ Request URL:', req.url);
    console.error('❌ Request method:', req.method);
    console.error('❌ Request body:', req.body);
    
    if (res.headersSent) {
        return next(error);
    }
    
    res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString(),
        context: 'Custom trading card game routes error handler',
        path: req.url,
        method: req.method
    });
});

// ============ EXPORT ROUTER ============

export default router;