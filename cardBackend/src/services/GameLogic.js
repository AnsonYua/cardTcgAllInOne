// src/services/GameLogic.js
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const mozDeckHelper = require('../mozGame/mozDeckHelper');
const mozGamePlay = require('../mozGame/mozGamePlay');
const path = require('path');
const mozAIClass = require('../mozGame/mozAIClass');

// Utility function to update game phase
function updatePhase(gameEnv, newPhase) {
    gameEnv.phase = newPhase;
    console.log(`🎯 Phase updated to: ${newPhase}`);
}


class GameLogic {
    constructor() {
        this.mozGamePlay = mozGamePlay;
    }


    async createNewGame(req) {
        var { playerId } = req.body;
        const gameId = uuidv4();
        
        // Only create room with first player (playerId_1), no deck dealing yet
        var gameEnv = {
            phase: 'WAITING_FOR_PLAYERS',
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
        
        // Load existing game data from file
        let gameData = await this.readJSONFileAsync(gameId);
        if (!gameData) {
            throw new Error('Game room not found');
        }
        
        let gameEnv = gameData.gameEnv;
        
        // Check if room is available
        if (gameEnv.phase !== 'WAITING_FOR_PLAYERS') {
            throw new Error('Room is not available for joining');
        }
        
        // Add second player
        gameEnv.playerId_2 = playerId;
        updatePhase(gameEnv, 'BOTH_JOINED');
        
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
        
        // Update to ready phase
        updatePhase(gameEnv, 'READY_PHASE');
        
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
        if (gameEnv.phase !== 'READY_PHASE') {
            throw new Error('Room is not ready for player ready status. Current phase: ' + gameEnv.phase);
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
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerList = getPlayerFromGameEnv(gameEnv);
        const bothReady = gameEnv.playersReady[playerList[0]] && gameEnv.playersReady[playerList[1]];
        console.log("🔍 Player List:", playerList);
        console.log("🔍 Players Ready Status:", gameEnv.playersReady);
        console.log("🔍 Both Ready:", bothReady);
        if (bothReady) {
            console.log("🎯 Both players ready - generating DRAW_PHASE_COMPLETE event");
            
            // Initialize game fields for all players (moved from redrawInBegining)
            for (let playerId of playerList) {
                let leader = this.mozGamePlay.cardInfoUtils.getCurrentLeader(gameEnv, playerId);
                gameEnv[playerId]["turnAction"] = []
                gameEnv[playerId]["Field"] = {};
                gameEnv[playerId]["Field"]["leader"] = leader;
                gameEnv[playerId]["Field"]["right"] = [];
                gameEnv[playerId]["Field"]["left"] = [];
                gameEnv[playerId]["Field"]["top"] = [];
                gameEnv[playerId]["Field"]["help"] = [];
                gameEnv[playerId]["Field"]["sp"] = [];
                
                // Initialize field effects for this player
                this.mozGamePlay.fieldEffectProcessor.initializePlayerFieldEffects(gameEnv, playerId);
                
                // Process leader field effects
                await this.mozGamePlay.fieldEffectProcessor.processLeaderFieldEffects(gameEnv, playerId, leader);
            }
            
            // Transition to draw phase first - game officially starts
            updatePhase(gameEnv, 'DRAW_PHASE');
            gameEnv.gameStarted = true;
            
            // Set current player to first player
            gameEnv.currentPlayer = playerList[gameEnv.firstPlayer];
            gameEnv.currentTurn = 0;
            
            // First player draws 1 card
            const currentPlayerId = gameEnv.currentPlayer;
            const hand = gameEnv[currentPlayerId].deck.hand;
            const mainDeck = gameEnv[currentPlayerId].deck.mainDeck;
            const mozDeckHelper = require('../mozGame/mozDeckHelper');
            const result = mozDeckHelper.drawToHand(hand, mainDeck);
            gameEnv[currentPlayerId].deck.hand = result.hand;
            gameEnv[currentPlayerId].deck.mainDeck = result.mainDeck;
            
            // Add draw phase event that requires acknowledgment
            this.mozGamePlay.addGameEvent(gameEnv, 'DRAW_PHASE_COMPLETE', {
                playerId: currentPlayerId,
                cardCount: 1,
                newHandSize: result.hand.length,
                requiresAcknowledgment: true
            });
            
            // Add game start event
            this.mozGamePlay.addGameEvent(gameEnv, 'GAME_PHASE_START', {
                phase: 'DRAW_PHASE',
                currentPlayer: currentPlayerId,
                message: 'Both players ready - draw phase started!'
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

        const sourceGameEnv = game.gameEnv;
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerIds = getPlayerFromGameEnv(sourceGameEnv);

        const players = {};
        const zones = {};
        const victoryPoints = {};

        playerIds.forEach(playerId => {
            if (sourceGameEnv[playerId]) {
                const playerData = sourceGameEnv[playerId];
                
                // Create structured player object
                players[playerId] = {
                    id: playerId,
                    name: playerData.name || playerId,
                    hand: playerData.deck?.hand || [],
                    deck: {
                        mainDeck: playerData.deck?.mainDeck || [],
                        leader: playerData.deck?.leader || [],
                        currentLeaderIdx: playerData.deck?.currentLeaderIdx || 0
                    },
                    isReady: sourceGameEnv.playersReady?.[playerId] || false,
                    redraw: playerData.redraw || 0,
                    turnAction: playerData.turnAction || [],
                    fieldEffects: playerData.fieldEffects || {
                        zoneRestrictions: {
                            "TOP": "ALL",
                            "LEFT": "ALL",
                            "RIGHT": "ALL",
                            "HELP": "ALL",
                            "SP": "ALL"
                        },
                        activeEffects: []
                    }
                };
                
                // Extract zone data with proper structure
                zones[playerId] = {
                    leader: playerData.Field?.leader || null,
                    TOP: playerData.Field?.top || [],
                    LEFT: playerData.Field?.left || [],
                    RIGHT: playerData.Field?.right || [],
                    HELP: playerData.Field?.help || [],
                    SP: playerData.Field?.sp || []
                };
                
                // Extract victory points
                victoryPoints[playerId] = playerData.playerPoint || 0;
            }
        });

        // Build the new, clean gameEnv object for the frontend
        const frontendGameEnv = {
            // Game Status
            phase: sourceGameEnv.phase || 'SETUP',
            currentPlayer: sourceGameEnv.currentPlayer,
            currentTurn: sourceGameEnv.currentTurn,
            round: sourceGameEnv.round || 1,
            gameStarted: sourceGameEnv.gameStarted,
            firstPlayer: sourceGameEnv.firstPlayer,

            // Centralized Data (No duplication)
            players,
            zones,
            victoryPoints,

            // Events and Actions
            gameEvents: sourceGameEnv.gameEvents || [],
            lastEventId: sourceGameEnv.lastEventId,
            pendingPlayerAction: sourceGameEnv.pendingPlayerAction || null,
            pendingCardSelections: sourceGameEnv.pendingCardSelections || {},
        };

        // Return the game object with the cleaned gameEnv
        return {
            ...game,
            gameEnv: frontendGameEnv
        };
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

        // Mark specified events as processed and check for DRAW_PHASE_COMPLETE
        let eventsAcknowledged = 0;
        let drawPhaseCompleted = false;
        
        if (gameData.gameEnv.gameEvents) {
            for (const eventId of eventIds) {
                const event = gameData.gameEnv.gameEvents.find(e => e.id === eventId);
                if (event && event.type === 'DRAW_PHASE_COMPLETE') {
                    drawPhaseCompleted = true;
                }
                
                const success = this.mozGamePlay.markEventProcessed(gameData.gameEnv, eventId);
                if (success) {
                    eventsAcknowledged++;
                }
            }
        }

        // If DRAW_PHASE_COMPLETE was acknowledged, transition to MAIN_PHASE
        if (drawPhaseCompleted && gameData.gameEnv.phase === 'DRAW_PHASE') {
            updatePhase(gameData.gameEnv, 'MAIN_PHASE');
            
            // Add main phase start event
            this.mozGamePlay.addGameEvent(gameData.gameEnv, 'PHASE_CHANGE', {
                phase: 'MAIN_PHASE',
                currentPlayer: gameData.gameEnv.currentPlayer,
                message: 'Draw phase acknowledged - main phase started!'
            });
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