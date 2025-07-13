// src/controllers/gameController.js
const gameLogic = require('../services/GameLogic');
const deckManager = require('../services/DeckManager');
class GameController {
    async startGame(req, res) {
        try {
            const gameState = await gameLogic.createNewGame(req);
            res.json(gameState);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async joinRoom(req, res) {
        try {
            const gameState = await gameLogic.joinRoom(req);
            res.json(gameState);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getPlayerDecks(req, res) {
        try {
            const { playerId } = req.params;
            const decks = await deckManager.getPlayerDecks(playerId);
            res.json(decks);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async startReady(req, res) {
        try {
            const gameState = await gameLogic.startReady(req);
            res.json(gameState);
        } catch (error) {
            res.status(500).json({ error: error.message ,stack: error.stack});
        }
    }

    async playerAction(req, res) {
        try {
            const gameState = await gameLogic.processPlayerAction(req);
            res.json(gameState);
        } catch (error) {
            res.status(500).json({ error: error.message ,stack: error.stack});
        }
    }

    async getPlayerData(req, res) {
        try {
            const { playerId } = req.params;
            const { gameId } = req.query; // Get gameId from query parameter
            
            if (!gameId) {
                return res.status(400).json({ error: 'gameId query parameter is required' });
            }
            
            let gameState = await gameLogic.getGameState(gameId);
            
            if (!gameState) {
                return res.status(404).json({ error: 'Game not found' });
            }

            res.json(gameState);
        } catch (error) {
            res.status(500).json({ error: error.message ,stack: error.stack});
        }
    }

    async playerAIAction(req, res) {
        try {
            let gameState = await gameLogic.playerAIAction(req);
            res.json(gameState);
        } catch (error) {
            res.status(500).json({ error: error.message  ,stack: error.stack});
        }
    }

    async selectCard(req, res) {
        try {
            const gameState = await gameLogic.selectCard(req);
            res.json(gameState);
        } catch (error) {
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    }

    async setCase(req, res) {
        try {
            const result = await gameLogic.setCaseInGameLogic(req);
            res.json(result);
        } catch (error) {
            console.error('Error in setCase:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async updateScore(req, res) {
        try {
            const { playerId } = req.params;
            const { score, gameId } = req.body;
            
            if (!gameId) {
                return res.status(400).json({ error: 'gameId is required' });
            }
            
            const updatedState = await gameLogic.updateGameState(gameId, { score });
            res.json(updatedState);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async acknowledgeEvents(req, res) {
        try {
            const { gameId, eventIds } = req.body;
            
            if (!gameId) {
                return res.status(400).json({ error: 'gameId is required' });
            }
            
            if (!eventIds || !Array.isArray(eventIds)) {
                return res.status(400).json({ error: 'eventIds array is required' });
            }
            
            const result = await gameLogic.acknowledgeGameEvents(gameId, eventIds);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async nextRound(req, res) {
        try {
            const { gameId } = req.body;
            
            if (!gameId) {
                return res.status(400).json({ error: 'gameId is required' });
            }
            
            const result = await gameLogic.nextRound(gameId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }


    async injectGameState(req, res) {
        try {
            const { gameId, gameEnv } = req.body;
            
            if (!gameEnv) {
                return res.status(400).json({ error: 'gameEnv is required' });
            }

            const result = await gameLogic.injectGameState(gameId, gameEnv);
            res.json(result);
        } catch (error) {
            console.error('Error in injectGameState:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new GameController();