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
        var { playerId ,gameId, players} = req.body;
        if (!gameId) {
            gameId = uuidv4();
        }     

        const startTask = []
        const playerArr = []
        for (let i = 0; i < players.length; i++) {
            const playerId = players[i];
            playerArr.push(playerId);
            startTask.push(mozDeckHelper.prepareDeckForPlayer(playerId));
        }

        const results = await Promise.all(startTask);
        
        var gameEnv = {}
        for (let i = 0; i < playerArr.length; i++) {
            gameEnv[playerArr[i]] = {
                "deck":results[i],
            };
        }
        gameEnv = this.mozGamePlay.updateInitialGameEnvironment(gameEnv);

        const newGame = {
            "gameId":gameId,
            "gameEnv":gameEnv,
            lastUpdate: new Date()
        };
        await this.saveOrCreateGame(newGame, gameId);
        return newGame;
    }

    async startReady(req) {
        var {playerId ,gameId,isRedraw} = req.body;
        var gameData = await this.readJSONFileAsync(gameId);
        const gameEnv = await this.mozGamePlay.redrawInBegining(gameData.gameEnv,playerId,isRedraw);
        gameData.gameEnv = gameEnv;
        await this.saveOrCreateGame(gameData, gameId);
        return gameData
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
            return updatedGameData;
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
        return newGame;
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
            return game;
        } catch (error) {
            return null;
        }
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
            return updatedGame;
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

        return {
            success: true,
            gameEnv: updatedGameEnv
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

        return {
            success: true,
            gameEnv: updatedGameEnv
        };
    }
}

module.exports = new GameLogic();