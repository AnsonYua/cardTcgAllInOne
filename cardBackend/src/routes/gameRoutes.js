// src/routes/gameRoutes.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const deckManager = require('../services/DeckManager');

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

router.get('/player/:playerId', gameController.getPlayerData);
router.put('/player/:playerId/score', gameController.updateScore);

router.post('/player/:playerId/deck', gameController.getPlayerDecks);

router.post('/player/startGame', gameController.startGame);
router.post('/player/joinRoom', gameController.joinRoom);
router.post('/player/startReady', gameController.startReady);
router.post('/player/playerAction', gameController.playerAction);
router.post('/player/playerAiAction', gameController.playerAIAction);
router.post('/player/selectCard', gameController.selectCard);
router.post('/player/acknowledgeEvents', gameController.acknowledgeEvents);
router.post('/player/nextRound', gameController.nextRound);
router.post('/test/setCase', gameController.setCase);
router.get('/test/getTestScenario', gameController.getTestScenario);

// Test-only endpoint for injecting game environment
router.post('/test/injectGameState', (req, res, next) => {
    /*
    if (process.env.NODE_ENV !== 'test') {
        return res.status(403).json({ error: 'This endpoint is only available in test environment' });
    }*/
    next();
}, gameController.injectGameState);

module.exports = router;