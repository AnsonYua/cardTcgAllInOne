// src/services/GameLogic.js
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const mozDeckHelper = require('../mozGame/mozDeckHelper');
const mozGamePlay = require('../mozGame/mozGamePlay');
const path = require('path');
const mozAIClass = require('../mozGame/mozAIClass');

// NEW: Card Effect System imports
const playSequenceManager = require('./PlaySequenceManager');
const effectSimulator = require('./EffectSimulator');
const cardEffectRegistry = require('./CardEffectRegistry');

// Utility function to update game phase
function updatePhase(gameEnv, newPhase) {
    gameEnv.phase = newPhase;
    console.log(`🎯 Phase updated to: ${newPhase}`);
}


class GameLogic {
    constructor() {
        this.mozGamePlay = mozGamePlay;
        
        // NEW: Initialize effect system with dependencies
        effectSimulator.setCardInfoUtils(this.mozGamePlay.cardInfoUtils);
        
        // NEW: Add effect system references
        this.playSequenceManager = playSequenceManager;
        this.effectSimulator = effectSimulator;
        this.cardEffectRegistry = cardEffectRegistry;
        
        // NEW: Inject dependencies into mozGamePlay
        this.mozGamePlay.playSequenceManager = playSequenceManager;
        this.mozGamePlay.effectSimulator = effectSimulator;
    }


    async createNewGame(req) {
        var { playerId } = req.body;
        const gameId = uuidv4();
        
        // NEW: Create unified structure from the start
        var gameEnv = {
            phase: 'WAITING_FOR_PLAYERS',
            playerId_1: playerId, // Store the actual playerId of player 1
            playerId_2: null,
            gameStarted: false,
            players: {},
            zones: {},
            fieldEffects: {}
        };
        
        // Initialize event system
        this.mozGamePlay.initializeEventSystem(gameEnv);
        
        // NEW: Initialize play sequence system
        this.playSequenceManager.initializePlaySequence(gameEnv);
        
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
        
        // NEW: Set up unified structure with decks
        gameEnv.players[player1Id] = { "id": player1Id, "name": player1Id, "deck": results[0] };
        gameEnv.players[player2Id] = { "id": player2Id, "name": player2Id, "deck": results[1] };
        gameEnv.zones[player1Id] = {};
        gameEnv.zones[player2Id] = {};
        gameEnv.fieldEffects[player1Id] = {};
        gameEnv.fieldEffects[player2Id] = {};
        
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
                
                // NEW: Record leader card play BEFORE setting up field
                this.playSequenceManager.recordCardPlay(
                    gameEnv,
                    playerId,
                    leader.id,
                    "PLAY_LEADER",
                    "leader",
                    {
                        leaderIndex: gameEnv.players[playerId].deck.currentLeaderIdx,
                        isInitialPlacement: true
                    }
                );
                
                // NEW: Initialize unified structure
                gameEnv.players[playerId].turnAction = [];
                gameEnv.players[playerId].isReady = true;
                gameEnv.players[playerId].redraw = 1;
                gameEnv.players[playerId].playerPoint = 0;
                
                gameEnv.zones[playerId] = {
                    leader: leader,
                    top: [],
                    left: [],
                    right: [],
                    help: [],
                    sp: []
                };
                
                // Initialize field effects for this player
                this.mozGamePlay.fieldEffectProcessor.initializePlayerFieldEffects(gameEnv, playerId);
            }
            
            // NEW: Initial simulation after all leaders are recorded
            const computedState = this.effectSimulator.simulateCardPlaySequence(gameEnv);
            gameEnv.computedState = computedState;
            
            // Transition to draw phase first - game officially starts
            updatePhase(gameEnv, 'DRAW_PHASE');
            gameEnv.gameStarted = true;
            
            // Set current player to first player
            gameEnv.currentPlayer = playerList[gameEnv.firstPlayer];
            gameEnv.currentTurn = 0;
            
            // First player draws 1 card
            const currentPlayerId = gameEnv.currentPlayer;
            const hand = gameEnv.players[currentPlayerId].deck.hand;
            const mainDeck = gameEnv.players[currentPlayerId].deck.mainDeck;
            const mozDeckHelper = require('../mozGame/mozDeckHelper');
            const result = mozDeckHelper.drawToHand(hand, mainDeck);
            gameEnv.players[currentPlayerId].deck.hand = result.hand;
            gameEnv.players[currentPlayerId].deck.mainDeck = result.mainDeck;
            
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
            
            // NEW: Record card play and simulate if card was played
            if (!actionResult.hasOwnProperty('error') && (action.type === 'PlayCard' || action.type === 'PlayCardBack')) {
                // Get the card ID from the hand using unified structure
                if (!gameData.gameEnv.players) {
                    throw new Error('Game environment must have unified structure with gameEnv.players');
                }
                const playerHand = gameData.gameEnv.players[playerId].deck.hand;
                
                const cardId = Array.isArray(playerHand) ? 
                    playerHand[action.card_idx]?.id || playerHand[action.card_idx] :
                    playerHand[action.card_idx];
                
                // Get zone name from field index
                const zoneMapping = ['top', 'left', 'right', 'help', 'sp'];
                const zoneName = zoneMapping[action.field_idx];
                
                // Record the card play
                this.playSequenceManager.recordCardPlay(
                    gameData.gameEnv,
                    playerId,
                    cardId,
                    "PLAY_CARD",
                    zoneName,
                    {
                        isFaceDown: action.type === 'PlayCardBack',
                        turnAction: action
                    }
                );
                
                // Simulate entire sequence with new card
                const computedState = this.effectSimulator.simulateCardPlaySequence(gameData.gameEnv);
                gameData.gameEnv.computedState = computedState;
            }
            
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

        // CRITICAL FIX: Initialize field effects for injected game state
        console.log('🔧 Initializing field effects for injected game state...');
        
        // 1. Initialize field effects structure for all players
        const playerIds = Object.keys(gameEnv.players || {});
        for (const playerId of playerIds) {
            this.mozGamePlay.fieldEffectProcessor.initializePlayerFieldEffects(gameEnv, playerId);
            console.log(`   ✅ Field effects initialized for ${playerId}`);
        }
        
        // 2. Process leader field effects for current leaders
        await this.mozGamePlay.fieldEffectProcessor.processAllFieldEffects(gameEnv);
        console.log('   ✅ Leader field effects processed');

        // 3. Run effect simulation to ensure computed state is current
        if (gameEnv.cardPlayHistory && gameEnv.cardPlayHistory.length > 0) {
            console.log('   🔄 Running effect simulation for existing card plays...');
            const computedState = this.effectSimulator.simulateCardPlaySequence(gameEnv);
            gameEnv.computedState = computedState;
            console.log('   ✅ Effect simulation completed');
        }

        // Create new game with properly initialized state
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

    /**
     * Transform hand card IDs to full card objects for frontend
     * @param {string[]} handCardIds - Array of card IDs
     * @returns {Object[]} Array of full card objects
     */
    transformHandCards(handCardIds) {
        if (!handCardIds || !Array.isArray(handCardIds)) {
            return [];
        }

        return handCardIds.map(cardId => {
            try {
                const cardDetails = this.mozGamePlay.cardInfoUtils.getCardDetails(cardId);
                if (!cardDetails) {
                    console.warn(`[GameLogic] Card details not found for hand card: ${cardId}`);
                    return {
                        id: cardId,
                        name: 'Unknown Card',
                        cardType: 'unknown',
                        gameType: 'unknown',
                        power: 0,
                        traits: []
                    };
                }
                
                return {
                    id: cardDetails.id,
                    name: cardDetails.name,
                    cardType: cardDetails.cardType,
                    gameType: cardDetails.gameType,
                    power: cardDetails.power || 0,
                    traits: cardDetails.traits || []
                };
            } catch (error) {
                console.error(`[GameLogic] Error transforming hand card ${cardId}:`, error);
                return {
                    id: cardId,
                    name: 'Error Card',
                    cardType: 'error',
                    gameType: 'error',
                    power: 0,
                    traits: []
                };
            }
        });
    }

    /**
     * Transform zone cardObj objects to simplified card format for frontend
     * @param {Object[]} cardObjects - Array of cardObj from backend zones
     * @returns {Object[]} Array of simplified card objects
     */
    transformZoneCards(cardObjects) {
        if (!cardObjects || !Array.isArray(cardObjects)) {
            return [];
        }

        return cardObjects.map(cardObj => {
            try {
                if (!cardObj.cardDetails || !cardObj.cardDetails[0]) {
                    console.warn(`[GameLogic] Invalid cardObj structure:`, cardObj);
                    return null;
                }

                const cardDetails = cardObj.cardDetails[0];
                return {
                    id: cardDetails.id,
                    name: cardDetails.name,
                    cardType: cardDetails.cardType,
                    gameType: cardDetails.gameType,
                    power: cardDetails.power || 0,
                    traits: cardDetails.traits || [],
                    isFaceDown: cardObj.isBack ? cardObj.isBack[0] : false,
                    valueOnField: cardObj.valueOnField || 0
                };
            } catch (error) {
                console.error(`[GameLogic] Error transforming zone card:`, error, cardObj);
                return null;
            }
        }).filter(card => card !== null); // Remove any null entries from errors
    }

    transformGameStateForFrontend(game) {
        if (!game || !game.gameEnv) {
            return game;
        }

        const sourceGameEnv = game.gameEnv;
        
        // Validate unified structure
        if (!sourceGameEnv.players || !sourceGameEnv.zones) {
            throw new Error('Game environment must have unified structure with gameEnv.players and gameEnv.zones');
        }

        // Game already uses unified format, return as-is
        return game;
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