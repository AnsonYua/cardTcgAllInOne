// src/services/GameLogic.js
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const mozDeckHelper = require('../mozGame/mozDeckHelper');
const mozGamePlay = require('../mozGame/mozGamePlay');
const path = require('path');
const mozAIClass = require('../mozGame/mozAIClass');


class GameLogic {
    constructor() {
        this.mozGamePlay = mozGamePlay;
    }


    async createNewGame(req) {
        var { playerId } = req.body;
        const gameId = uuidv4();
        
        // Only create room with first player (playerId_1), no deck dealing yet
        var gameEnv = {
            roomStatus: 'WAITING_FOR_PLAYERS',
            playerId_1: playerId, // Store the actual playerId of player 1
            playerId_2: null,
            gameStarted: false
        };
        
        // Initialize event system
        this.mozGamePlay.initializeEventSystem(gameEnv);
        
        // Add room created event
        this.mozGamePlay.addGameEvent(gameEnv, 'ROOM_CREATED', {
            gameId: gameId,
            createdBy: playerId,
            status: 'WAITING_FOR_PLAYERS'
        });

        const newGame = {
            "gameId": gameId,
            "gameEnv": gameEnv,
            lastUpdate: new Date()
        };
        await this.saveOrCreateGame(newGame, gameId);
        return this.transformGameStateForFrontend(newGame);
    }

    async joinRoom(req) {
        var { playerId, gameId } = req.body;
        
        // Load existing game
        let gameState = await this.getGameState(gameId);
        if (!gameState) {
            throw new Error('Game room not found');
        }
        
        let gameEnv = gameState.gameEnv;
        
        // Check if room is available
        if (gameEnv.roomStatus !== 'WAITING_FOR_PLAYERS') {
            throw new Error('Room is not available for joining');
        }
        
        // Add second player
        gameEnv.playerId_2 = playerId;
        gameEnv.roomStatus = 'BOTH_JOINED';
        
        // Now prepare decks for both players
        const player1Id = gameEnv.playerId_1;
        const player2Id = gameEnv.playerId_2;
        
        const startTask = [
            mozDeckHelper.prepareDeckForPlayer(player1Id),
            mozDeckHelper.prepareDeckForPlayer(player2Id)
        ];
        
        const results = await Promise.all(startTask);
        
        // Set up game environment with decks
        gameEnv[player1Id] = { "deck": results[0] };
        gameEnv[player2Id] = { "deck": results[1] };
        
        // Initialize game environment (deals hands, sets up leaders, etc.)
        gameEnv = this.mozGamePlay.updateInitialGameEnvironment(gameEnv);
        
        // Update room status to ready phase
        gameEnv.roomStatus = 'READY_PHASE';
        
        // Add player joined event
        this.mozGamePlay.addGameEvent(gameEnv, 'PLAYER_JOINED', {
            playerId: playerId,
            roomStatus: 'BOTH_JOINED',
            readyForStart: true
        });

        const updatedGame = {
            "gameId": gameId,
            "gameEnv": gameEnv,
            lastUpdate: new Date()
        };
        await this.saveOrCreateGame(updatedGame, gameId);
        return this.transformGameStateForFrontend(updatedGame);
    }

    async startReady(req) {
        var {playerId, gameId, isRedraw} = req.body;
        var gameData = await this.readJSONFileAsync(gameId);
        let gameEnv = gameData.gameEnv;
        
        // Check if room is in correct state
        if (gameEnv.roomStatus !== 'READY_PHASE') {
            throw new Error('Room is not ready for player ready status. Current status: ' + gameEnv.roomStatus);
        }
        
        // Handle redraw logic
        gameEnv = await this.mozGamePlay.redrawInBegining(gameEnv, playerId, isRedraw);
        
        // Track which players are ready
        if (!gameEnv.playersReady) {
            gameEnv.playersReady = {};
        }
        gameEnv.playersReady[playerId] = true;
        
        // Add player ready event
        this.mozGamePlay.addGameEvent(gameEnv, 'PLAYER_READY', {
            playerId: playerId,
            isRedraw: isRedraw
        });
        
        // Check if both players are ready
        const player1Id = gameEnv.playerId_1;
        const player2Id = gameEnv.playerId_2;
        const bothReady = gameEnv.playersReady[player1Id] && gameEnv.playersReady[player2Id];
        
        if (bothReady) {
            // Transition to main phase - game officially starts
            gameEnv.roomStatus = 'MAIN_PHASE';
            gameEnv.gameStarted = true;
            
            // Add game start event
            this.mozGamePlay.addGameEvent(gameEnv, 'GAME_PHASE_START', {
                phase: 'MAIN_PHASE',
                message: 'Both players ready - game officially started!'
            });
        }
        
        gameData.gameEnv = gameEnv;
        await this.saveOrCreateGame(gameData, gameId);
        return this.transformGameStateForFrontend(gameData);
    }
    
    async processPlayerAction(req) {
        var {playerId ,gameId,action} = req.body;
        var gameData = await this.readJSONFileAsync(gameId);
        const result = await this.mozGamePlay.checkIsPlayOkForAction(gameData.gameEnv,playerId,action);
        if(!result){
            return this.mozGamePlay.throwError("Not your turn");
        }else{
            const actionResult = await this.mozGamePlay.processAction(gameData.gameEnv,playerId,action);
            
            if (actionResult.hasOwnProperty('error')){
                return actionResult;
            }
            
            // Always update gameEnv and save
            gameData.gameEnv = actionResult.requiresCardSelection ? actionResult.gameEnv : actionResult;
            const updatedGameData = this.addUpdateUUID(gameData);
            await this.saveOrCreateGame(updatedGameData, gameId);
            
            // Return the updated game data - client can determine card selection from pendingPlayerAction
            return this.transformGameStateForFrontend(updatedGameData);
        }
    }

    async playerAIAction(req) {
        var {playerId ,gameId} = req.body;
        var gameData = await this.readJSONFileAsync(gameId);
        return await mozAIClass.getAIAction(gameData.gameEnv,playerId);
    }

    addUpdateUUID(returnVale){
        returnVale["updateUUID"] = uuidv4();
        returnVale["lastUpdate"] = new Date()
        return returnVale;
    }
    async setCaseInGameLogic(req) {
        const {caseFile,gameId} = req.body;
        var game = await this.readJSONFileAsync(caseFile,"../testData/")
        await this.saveOrCreateGame(game, gameId);
        return game;
    }

    async injectGameState(gameId, gameEnv) {
        // Only allow in test environment
        /*
        if (process.env.NODE_ENV !== 'test') {
            throw new Error('This method is only available in test environment');
        }*/

        // Create a new game ID if not provided
        if (!gameId) {
            gameId = uuidv4();
        }

        // Create new game with injected state
        const newGame = {
            gameId: gameId,
            gameEnv: gameEnv,
            lastUpdate: new Date()
        };

        await this.saveOrCreateGame(newGame, gameId);
        return this.transformGameStateForFrontend(newGame);
    }

    async saveOrCreateGame(data, gameId) {
        const jsonString = JSON.stringify(data, null, 2); // The '2' adds nice formatting
        //await fs.writeFile(path.join(__dirname, '../gameData/'+gameId+'.json'), jsonString);
        await this.writeFileAsync(path.join(__dirname, '../gameData/'+gameId+'.json'), jsonString);
    }
    async writeFileAsync(filename, data) {
        return new Promise((resolve, reject) => {
          try {
            fs.writeFileSync(filename, data); // Synchronous file write
            resolve(); // Resolve the promise when the operation succeeds
          } catch (error) {
            reject(error); // Reject the promise if an error occurs
          }
        });
    }
    async readJSONFileAsync(gameId, folderPath='../gameData/') {
        const filename = path.join(__dirname, folderPath+gameId+'.json');
        return new Promise((resolve, reject) => {
            fs.readFile(filename, (error, data) => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        console.error('File not found:', filename);
                    } else {
                        console.error('Error reading file:', error.message);
                    }
                    reject(error);
                    return;
                }
                
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (parseError) {
                    console.error('Error parsing JSON:', parseError.message);
                    reject(parseError);
                }
            });
        });
    }

    async getGameState(gameId) {
        try {
            const game = await this.readJSONFileAsync(gameId);
            return this.transformGameStateForFrontend(game);
        } catch (error) {
            return null;
        }
    }

    transformGameStateForFrontend(game) {
        if (!game || !game.gameEnv) {
            return game;
        }

        // Create a copy of the game state
        const transformedGame = { ...game };
        const gameEnv = { ...game.gameEnv };

        // Extract player data and create players object
        const players = {};
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerIds = getPlayerFromGameEnv(gameEnv);

        playerIds.forEach(playerId => {
            if (gameEnv[playerId]) {
                players[playerId] = {
                    id: playerId,
                    name: playerId, // Using playerId as name for now
                    ...gameEnv[playerId]
                };
            }
        });

        // Add players object to gameEnv
        gameEnv.players = players;

        transformedGame.gameEnv = gameEnv;
        return transformedGame;
    }

    async updateGameState(gameId, updates) {
        try {
            const game = await this.readJSONFileAsync(gameId);
            
            // Update game state
            const updatedGame = {
                ...game,
                ...updates,
                lastUpdate: new Date()
            };
            
            await this.saveOrCreateGame(updatedGame, gameId);
            return this.transformGameStateForFrontend(updatedGame);
        } catch (error) {
            throw new Error('Game not found');
        }
    }

    async selectCard(req) {
        const { selectionId, selectedCardIds, playerId, gameId } = req.body;
        
        if (!selectionId || !selectedCardIds || !playerId) {
            throw new Error('Missing required parameters: selectionId, selectedCardIds, playerId');
        }

        const gameData = await this.readJSONFileAsync(gameId);
        if (!gameData) {
            throw new Error('Game not found');
        }

        // Complete the card selection in mozGamePlay
        const updatedGameEnv = await this.mozGamePlay.completeCardSelection(
            gameData.gameEnv, 
            selectionId, 
            selectedCardIds
        );

        if (updatedGameEnv.error) {
            throw new Error(updatedGameEnv.error);
        }

        // Update the stored game state
        gameData.gameEnv = updatedGameEnv;
        const updatedGameData = this.addUpdateUUID(gameData);
        await this.saveOrCreateGame(updatedGameData, gameId);

        const transformedGame = this.transformGameStateForFrontend(updatedGameData);
        return {
            success: true,
            gameEnv: transformedGame.gameEnv
        };
    }

    async acknowledgeGameEvents(gameId, eventIds) {
        // Read current game state
        const gameData = await this.readJSONFileAsync(gameId);

        // Mark specified events as processed
        let eventsAcknowledged = 0;
        if (gameData.gameEnv.gameEvents) {
            for (const eventId of eventIds) {
                const success = this.mozGamePlay.markEventProcessed(gameData.gameEnv, eventId);
                if (success) {
                    eventsAcknowledged++;
                }
            }
        }

        // Clean expired events and save
        this.mozGamePlay.cleanExpiredEvents(gameData.gameEnv);
        const updatedGameData = this.addUpdateUUID(gameData);
        await this.saveOrCreateGame(updatedGameData, gameId);

        return {
            success: true,
            eventsAcknowledged: eventsAcknowledged,
            remainingEvents: gameData.gameEnv.gameEvents ? gameData.gameEnv.gameEvents.length : 0
        };
    }

    async nextRound(gameId) {
        // Read current game state
        const gameData = await this.readJSONFileAsync(gameId);

        // Call mozGamePlay's next round method
        const updatedGameEnv = await this.mozGamePlay.concludeLeaderBattleAndNewStart(gameData.gameEnv, null);

        if (updatedGameEnv.error) {
            throw new Error(updatedGameEnv.error);
        }

        // Update the stored game state
        gameData.gameEnv = updatedGameEnv;
        const updatedGameData = this.addUpdateUUID(gameData);
        await this.saveOrCreateGame(updatedGameData, gameId);

        const transformedGame = this.transformGameStateForFrontend(updatedGameData);
        return {
            success: true,
            gameEnv: transformedGame.gameEnv
        };
    }
}

module.exports = new GameLogic();