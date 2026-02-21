// src/routes/gameRoutes.ts
// PLACEHOLDER - Custom Trading Card Game Routes

import express, { Request, Response, NextFunction } from 'express';
import { gameController } from '../controllers/gameController';
import { choiceController } from '../controllers/choiceController';
import { gameLogic } from '../services/GameLogic';
import { requirePlayerSession } from '../middleware/sessionAuth';

// ============ TYPE DEFINITIONS ============

export interface RouteHandler {
    (req: Request, res: Response, next?: NextFunction): Promise<void> | void;
}

// ============ ROUTER SETUP ============

const router = express.Router();

// ============ ENV FLAGS ============

const readEnvFlag = (name: string, defaultValue: boolean): boolean => {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return defaultValue;

    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(normalized)) return false;

    return defaultValue;
};

const injectGameStateEnabled = readEnvFlag('INJECT_GAME_STATE_ENABLED', process.env.NODE_ENV !== 'production');
const saveExceptionScenarioEnabled = readEnvFlag('SAVE_EXCEPTION_SCENARIO_ENABLED', process.env.NODE_ENV !== 'production');

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
router.get('/status', (_req: Request, res: Response) => {
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
 * Choose which player goes first
 * POST /api/game/player/chooseFirstPlayer
 */
router.post('/player/chooseFirstPlayer', requirePlayerSession, gameController.chooseFirstPlayer.bind(gameController));
/**
 * Start ready phase for a player
 * POST /api/game/player/startReady
 */
router.post('/player/startReady', requirePlayerSession, gameController.startReady.bind(gameController));

/**
 * Submit deck data for a player
 * POST /api/game/player/submitDeck
 */
router.post('/player/submitDeck', requirePlayerSession, gameController.submitDeck.bind(gameController));

/**
 * Session heartbeat
 * POST /api/game/player/heartbeat
 */
router.post('/player/heartbeat', requirePlayerSession, gameController.heartbeat.bind(gameController));

/**
 * Get game resource data (deck data for frontend card preloading)
 * GET /api/game/player/gameResource
 */
router.get('/player/gameResource', gameController.getGameResource.bind(gameController));

/**
 * Get game resource bundle (single request)
 * POST /api/game/player/gameResourceBundle
 */
router.post('/player/gameResourceBundle', gameController.getGameResourceBundle.bind(gameController));

/**
 * List available lobby rooms
 * GET /api/game/lobbylist
 */
router.get('/lobbylist', gameController.getLobbyList.bind(gameController));

/**
 * Get player game data
 * GET /api/game/player/:playerId?gameId=...
 */
router.get('/player/:playerId', requirePlayerSession, gameController.getPlayerData.bind(gameController));

/**
 * Process player action (play cards)
 * POST /api/game/player/playCard
 */
router.post('/player/playCard', requirePlayerSession, gameController.playCard.bind(gameController));

/**
 * Execute player action (attacks, abilities, etc.)
 * POST /api/game/player/playerAction
 */
router.post('/player/playerAction', requirePlayerSession, gameController.playerAction.bind(gameController));

/**
 * End current player's turn and advance game state
 * POST /api/game/player/endTurn
 */
router.post('/player/endTurn', requirePlayerSession, gameController.endTurn.bind(gameController));

// ============ CUSTOM CARD DATA ENDPOINTS ============

/**
 * Get custom card data (st01Card.json)
 * GET /api/game/cards
 */
router.get('/cards', gameController.getCardData.bind(gameController));

/**
 * List available card sets (gd01/st01/...)
 * GET /api/game/cardSets
 */
router.get('/cardSets', gameController.getCardSets.bind(gameController));

/**
 * List top deck pick list parsed from src/data/topDeck.md
 * GET /api/game/topDecks
 */
router.get('/topDecks', gameController.getTopDecks.bind(gameController));

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
router.post('/player/selectCard', requirePlayerSession, async (_req: Request, res: Response) => {
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
router.post('/player/acknowledgeEvents', requirePlayerSession, async (req: Request, res: Response) => {
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
router.post('/player/confirmBurstChoice', requirePlayerSession, gameController.confirmBurstChoice.bind(gameController));

/**
 * Confirm deploy target choice
 * POST /api/game/player/confirmDeployChoice
 */
router.post('/player/confirmTargetChoice', requirePlayerSession, gameController.confirmTargetChoice.bind(gameController));

/**
 * Confirm blocker choice decision during combat
 * POST /api/game/player/confirmBlockerChoice
 */
router.post('/player/confirmBlockerChoice', requirePlayerSession, gameController.confirmBlockerChoice.bind(gameController));

/**
 * Confirm token choice decision
 * POST /api/game/player/confirmTokenChoice
 */
router.post('/player/confirmTokenChoice', requirePlayerSession, gameController.confirmTokenChoice.bind(gameController));

/**
 * Confirm generic option choice decision
 * POST /api/game/player/confirmOptionChoice
 */
router.post('/player/confirmOptionChoice', requirePlayerSession, gameController.confirmOptionChoice.bind(gameController));

/**
 * Cancel (decline) a pending choice when the frontend closes the dialog
 * POST /api/game/player/cancelChoice
 */
router.post('/player/cancelChoice', requirePlayerSession, choiceController.cancelChoice.bind(choiceController));

/**
 * AI player action
 * POST /api/game/player/playerAiAction
 */
router.post('/player/playerAiAction', requirePlayerSession, gameController.playerAiAction.bind(gameController));

/**
 * Update player score (placeholder)
 * PUT /api/game/player/:playerId/score
 */
router.put('/player/:playerId/score', requirePlayerSession, async (_req: Request, res: Response) => {
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
    // Environment flag middleware
    (_req: Request, res: Response, next: NextFunction) => {
        if (!injectGameStateEnabled) {
            res.status(403).json({ 
                error: 'This endpoint is disabled (set INJECT_GAME_STATE_ENABLED=true to enable)',
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
 * Resolve a seat session for existing game state (test/dev only)
 * POST /api/game/test/resolveSeatSession
 */
router.post('/test/resolveSeatSession',
    (_req: Request, res: Response, next: NextFunction) => {
        if (!injectGameStateEnabled) {
            res.status(403).json({
                error: 'This endpoint is disabled (set INJECT_GAME_STATE_ENABLED=true to enable)',
                timestamp: new Date().toISOString()
            });
            return;
        }
        next();
    },
    gameController.resolveSeatSession.bind(gameController)
);

/**
 * Save current game env as exception scenario
 * POST /api/game/test/saveExceptionScenario
 */
router.post('/test/saveExceptionScenario',
    (_req: Request, res: Response, next: NextFunction) => {
        if (!saveExceptionScenarioEnabled) {
            res.status(403).json({
                error: 'This endpoint is disabled (set SAVE_EXCEPTION_SCENARIO_ENABLED=true to enable)',
                timestamp: new Date().toISOString()
            });
            return;
        }
        next();
    },
    gameController.saveExceptionScenario.bind(gameController)
);

/**
 * Set test case (development only)
 * POST /api/game/test/setCase
 */
router.post('/test/setCase', async (_req: Request, res: Response) => {
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
