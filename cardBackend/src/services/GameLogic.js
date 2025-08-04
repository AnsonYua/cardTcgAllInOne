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
const { GamePhase } = require('../../dist/src/models/GameEnvironment');

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

    /**
     * In this phrase, player deck is not initialized
     */
    async createNewGame(req) {
        var { playerId } = req.body;
        const gameId = uuidv4();
        
        // NEW: Use GameEnvironment class for proper object-oriented structure
        const { GameEnvironmentAdapter } = require('../../dist/src/utils/GameEnvironmentAdapter');
        const gameEnvClass = GameEnvironmentAdapter.createNewGame(playerId);
        
        // The GameEnvironmentAdapter.createNewGame already:
        // - Initializes the GameEnvironment class with proper structure
        // - Adds the first player using class methods
        // - Creates the ROOM_CREATED event using class event manager
        // - Sets up all required initial state
        
        // Convert to legacy format only for file storage compatibility
        var gameEnv = GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);

        const newGame = {
            "gameId": gameId,
            "gameEnv": gameEnv,
            lastUpdate: new Date()
        };
        await this.saveOrCreateGame(newGame, gameId);
        return newGame;
    }
    /**
     * 
     * Deck and hand only initialized in gameEnv when both player joined
     */
    async joinRoom(req) {
        var { playerId, gameId } = req.body;
        
        // Load existing game data from file
        let gameData = await this.readJSONFileAsync(gameId);
        if (!gameData) {
            throw new Error('Game room not found');
        }
        if(playerId=="playerId_1"){
            throw new Error('duplicated playerID');
        }
        
        // NEW: Convert legacy gameEnv to class for manipulation
        const { GameEnvironmentAdapter } = require('../../dist/src/utils/GameEnvironmentAdapter');
        let gameEnvClass = GameEnvironmentAdapter.fromLegacyJSON(gameData.gameEnv);
        
        // Check if room is available using class property
        if (gameEnvClass.phase !== GamePhase.WAITING_FOR_PLAYERS) {
            throw new Error('Room is not available for joining');
        }
        
        // Now prepare decks for both players
        const player1Id = gameEnvClass.playerId_1;
        
        // Prepare deck data for both players - generates shuffled cards, draws initial hand,
        // creates UID mappings for frontend compatibility, and returns PlayerDeckDataResp class instances
        // with 7-card hand, 4 shuffled leader cards, and complete deck/leader UID mappings
        const startTask = [
            mozDeckHelper.prepareDeckForPlayer(player1Id),
            mozDeckHelper.prepareDeckForPlayer(playerId)
        ];
        
        const results = await Promise.all(startTask);
        
        // NEW: Use adapter to add second player with class methods
        // This handles:
        // - Adding player 2 using gameEnvClass.addPlayer()
        // - Setting deck data using class methods
        // - Updating phase using gameEnvClass.updatePhase()
        // - Adding PLAYER_JOINED event using gameEnvClass.eventManager.addEvent()
        GameEnvironmentAdapter.addSecondPlayer(gameEnvClass, playerId, results[0], results[1]);
        
        // NEW: Initialize game environment directly using class methods
        // This replaces mozGamePlay.updateInitialGameEnvironment() and handles:
        // - Event system initialization (already done in class constructor)
        // - First player determination based on leader initial points
        // - Phase update to GamePhase.READY_PHASE
        // - Player redraw count initialization
        // - Game started and initial hand dealt events
        GameEnvironmentAdapter.initializeGameEnvironment(gameEnvClass);
        
        // Convert class back to legacy format for file storage compatibility
        let gameEnv = GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);

        const updatedGame = {
            "gameId": gameId,
            "gameEnv": gameEnv,
            lastUpdate: new Date()
        };
        await this.saveOrCreateGame(updatedGame, gameId);
        return updatedGame;
    }

    async startReady(req) {
     
        var {playerId, gameId, isRedraw} = req.body;
        var gameData = await this.readJSONFileAsync(gameId);
        
        // NEW: Work directly with GameEnvironment class throughout the method
        const { GameEnvironmentAdapter } = require('../../dist/src/utils/GameEnvironmentAdapter');
        let gameEnvClass = GameEnvironmentAdapter.fromLegacyJSON(gameData.gameEnv);
        
        // Check if room is in correct state
        if (gameEnvClass.phase !== GamePhase.REDRAW_PHASE) {
            throw new Error('Room is not ready for player ready status. Current phase: ' + gameEnvClass.phase);
        }
        
        // Use class method for redraw processing
        await gameEnvClass.processPlayerRedraw(playerId, isRedraw);
        
        // Track which players are ready using class methods
        gameEnvClass.setPlayerReady(playerId, true);
        
        // Check if both players are ready using class methods
        const playerList = [gameEnvClass.playerId_1, gameEnvClass.playerId_2].filter(id => id);
        const bothReady = gameEnvClass.areAllPlayersReady();
        console.log("🔍 Player List:", playerList);
        console.log("🔍 Players Ready Status:", gameEnvClass.getPlayersReadyStatus());
        console.log("🔍 Both Ready:", bothReady);
        if (bothReady) {
            console.log("🎯 Both players ready - generating DRAW_PHASE_COMPLETE event");
            
            // Initialize game fields for all players using class methods
            // IMPORTANT: Record leader plays in first player order for proper sequencing
            const firstPlayerIndex = gameEnvClass.firstPlayer || 0;
            const orderedPlayerList = [
                playerList[firstPlayerIndex],
                playerList[1 - firstPlayerIndex]  // Other player
            ];
            
            for (let playerId of orderedPlayerList) {
                // Get player using class method
                const player = gameEnvClass.getPlayer(playerId);
                if (!player) continue;
                
                // Get current leader using class method
                const currentLeaderId = player.getCurrentLeaderCardId();
                if (!currentLeaderId) continue;
                
                // Get leader details
                const leader = this.mozGamePlay.cardInfoUtils.getLeaderCards(currentLeaderId);
                if (!leader) continue;
                
                // Record leader card play using class methods
                gameEnvClass.playSequenceManager.addPlay(
                    playerId,
                    leader.id,
                    "PLAY_LEADER",
                    "leader",
                    false, // isFaceDown
                    {
                        leaderIndex: player.deck.currentLeaderIdx,
                        isInitialPlacement: true
                    }
                );
                
                // Initialize player state using class properties
                player.turnAction = [];
                player.isReady = true;
                player.redraw = 1;
                player.playerPoint = 0;
                
                // Set leader in zone using class method
                const leaderZoneData = {
                    id: leader.id,
                    name: leader.name,
                    cardType: leader.cardType,
                    gameType: leader.gameType,
                    initialPoint: leader.initialPoint,
                    level: leader.level,
                    rarity: leader.rarity,
                    zoneCompatibility: leader.zoneCompatibility,
                    effects: leader.effects
                };
                gameEnvClass.zones.setLeaderInZone(playerId, leaderZoneData);
                
                // Initialize field effects for this player using class method
                player.initializeFieldEffects();
            }
            
            // UNIFIED EFFECT SIMULATION: Process all leader effects using class
            // Effects are applied directly to gameEnvClass.players[].fieldEffects (single source of truth)
            await this.effectSimulator.simulateCardPlaySequence(gameEnvClass.toJSON());
            
            // No merge needed - all effects are already in gameEnvClass.players[].fieldEffects!
            
            // Transition to draw phase first - game officially starts using class method
            gameEnvClass.updatePhase(GamePhase.DRAW_PHASE);
            gameEnvClass.gameStarted = true;
            
            // Set current player to first player using class properties
            gameEnvClass.currentPlayer = playerList[gameEnvClass.firstPlayer];
            gameEnvClass.currentTurn = 0;
            
            // First player draws 1 card using class methods
            const currentPlayerId = gameEnvClass.currentPlayer;
            const currentPlayer = gameEnvClass.getPlayer(currentPlayerId);
            if (currentPlayer) {
                const hand = currentPlayer.deck.hand;
                const mainDeck = currentPlayer.deck.mainDeck;
                const mozDeckHelper = require('../mozGame/mozDeckHelper');
                const result = mozDeckHelper.drawToHand(hand, mainDeck);
                currentPlayer.deck.hand = result.hand;
                currentPlayer.deck.mainDeck = result.mainDeck;
                
                // Add draw phase event using class event manager
                gameEnvClass.eventManager.addEvent('DRAW_PHASE_COMPLETE', {
                    playerId: currentPlayerId,
                    cardCount: 1,
                    newHandSize: result.hand.length,
                    requiresAcknowledgment: true
                });
                
                // Add game start event using class event manager
                gameEnvClass.eventManager.addEvent('GAME_PHASE_START', {
                    phase: GamePhase.DRAW_PHASE,
                    currentPlayer: currentPlayerId,
                    message: 'Both players ready - draw phase started!'
                });
            }
        }
        
        // Convert class back to legacy JSON format only for file storage
        gameData.gameEnv = GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);
        await this.saveOrCreateGame(gameData, gameId);
        return gameData;
    }
    
    async processPlayerAction(req) {
        var {playerId ,gameId,action} = req.body;
        console.log(`DEBUG: Processing action for ${playerId} in game ${gameId}: ${action.type}`);
        
        try {
            var gameData = await this.readJSONFileAsync(gameId);
            console.log(`DEBUG: Game data loaded successfully`);
            
            console.log(`DEBUG: About to call checkIsPlayOkForAction`);
            const result = await this.mozGamePlay.checkIsPlayOkForAction(gameData.gameEnv,playerId,action);
            console.log(`DEBUG: checkIsPlayOkForAction result: ${result}`);
            
            if(!result){
                return this.mozGamePlay.throwError("Not your turn");
            }
            
            // NEW: Capture card information AND game state BEFORE processAction for card plays
            let cardToRecord = null;
            let zoneToRecord = null;
            let turnWhenPlayed = null;
            let phaseWhenPlayed = null;
            if (action.type === 'PlayCard' || action.type === 'PlayCardBack') {
                // CRITICAL: Capture card ID BEFORE processAction modifies the hand
                const originalPlayerHand = gameData.gameEnv.players[playerId].deck.hand;
                cardToRecord = originalPlayerHand[action.card_idx];
                
                // Get zone name from field index
                const zoneMapping = ['top', 'left', 'right', 'help', 'sp'];
                zoneToRecord = zoneMapping[action.field_idx];
                
                // CRITICAL: Capture turn and phase BEFORE processAction changes them
                turnWhenPlayed = gameData.gameEnv.currentTurn || 0;
                phaseWhenPlayed = gameData.gameEnv.phase || 'SETUP';
            }
            
            console.log(`DEBUG: About to call processAction`);
            const actionResult = await this.mozGamePlay.processAction(gameData.gameEnv,playerId,action);
            console.log(`DEBUG: processAction completed`);
            
            if (actionResult.hasOwnProperty('error')){
                return actionResult;
            }
            
            // Always update gameEnv and save
            gameData.gameEnv = actionResult.requiresCardSelection ? actionResult.gameEnv : actionResult;
            
            // NEW: Record card play and simulate if card was played
            if (!actionResult.hasOwnProperty('error') && cardToRecord && zoneToRecord) {
                // Record the card play with correct timing (before state changes)
                this.playSequenceManager.recordCardPlay(
                    gameData.gameEnv,
                    playerId,
                    cardToRecord,
                    "PLAY_CARD",
                    zoneToRecord,
                    {
                        isFaceDown: action.type === 'PlayCardBack',
                        cardIndex: action.card_idx,
                        fieldIndex: action.field_idx
                    },
                    {
                        turnNumber: turnWhenPlayed,
                        phaseWhenPlayed: phaseWhenPlayed
                    }
                );
                
                // UNIFIED EFFECT SIMULATION: Process all effects directly on gameEnv
                await this.effectSimulator.simulateCardPlaySequence(gameData.gameEnv);
                
                // No merge needed - all effects applied directly to gameEnv.players[].fieldEffects!
            }
            
            const updatedGameData = this.addUpdateUUID(gameData);
            await this.saveOrCreateGame(updatedGameData, gameId);
            
            // Return the updated game data - client can determine card selection from pendingPlayerAction
            return updatedGameData;
            
        } catch (error) {
            console.error(`ERROR in processPlayerAction:`, error.message);
            console.error(`Stack trace:`, error.stack);
            throw error;
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

    /**
     * INJECT GAME STATE - Test Environment Game State Injection
     * =======================================================
     * 
     * PURPOSE: Inject a complete game state for testing scenarios, ensuring all 
     * leader effects, zone restrictions, and field effects are properly applied.
     * 
     * This method is critical for testing because it:
     * 1. Takes a raw game state (like from a test scenario JSON)
     * 2. Ensures proper play sequence recording for leaders
     * 3. Runs the unified effect simulation to calculate zone restrictions
     * 4. Merges computed effects back into the main game structure
     * 5. Saves the fully initialized state for testing
     * 
     * WORKFLOW:
     * Step 1: Initialize play sequence if missing
     * Step 2: Record leader plays if leaders exist but aren't in sequence  
     * Step 3: Run unified effect simulation (EffectSimulator)
     * Step 4: Merge computed zone restrictions back to main gameEnv
     * Step 5: Save and return the complete game state
     * 
     * @param {string} gameId - Game identifier for the test
     * @param {Object} gameEnv - Raw game environment to inject
     * @returns {Object} Fully initialized game state with all effects applied
     */
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

        console.log('🔧 Initializing injected game state with proper leader sequence...');
        
        // STEP 1: Initialize play sequence if not present
        // ================================================
        // The play sequence is the chronological record of all game actions (including leaders).
        // This is CRITICAL for the unified effect system because EffectSimulator replays 
        // the entire sequence to calculate effects consistently.
        if (!gameEnv.playSequence) {
            this.playSequenceManager.initializePlaySequence(gameEnv);
            console.log('   🎯 Initialized empty play sequence');
        }
        
        // STEP 2: Check if leaders need to be recorded in play sequence  
        // ============================================================
        // PROBLEM: Test scenarios often have leaders already placed in zones but missing 
        // from the play sequence. This breaks the unified effect system because:
        // - EffectSimulator only processes PLAY_LEADER actions in the sequence
        // - No PLAY_LEADER actions = no zone restrictions applied
        // - Result: Leader effects like Trump's zone restrictions are ignored
        //
        // SOLUTION: Detect this situation and auto-record missing leader plays
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        // Check if we have leaders in zones but no leader plays in sequence
        const hasLeadersInZones = playerList.some(playerId => {
            const playerZones = gameEnv.zones?.[playerId];
            return playerZones?.leader;
        });
        
        const hasLeaderPlays = gameEnv.playSequence.plays.some(play => play.action === 'PLAY_LEADER');
        
        if (hasLeadersInZones && !hasLeaderPlays) {
            console.log('   🎯 Leaders found in zones but not in play sequence - recording leader plays...');
            
            // Record leader plays in first player order (same as normal game startup)
            const firstPlayerIndex = gameEnv.firstPlayer || 0;
            const orderedPlayerList = [
                playerList[firstPlayerIndex],
                playerList[1 - firstPlayerIndex]  // Other player
            ];
            
            for (let playerId of orderedPlayerList) {
                const playerZones = gameEnv.zones?.[playerId];
                if (playerZones?.leader) {
                    const leader = playerZones.leader;
                    
                    // Record leader play in sequence
                    this.playSequenceManager.recordCardPlay(
                        gameEnv,
                        playerId,
                        leader.id,
                        "PLAY_LEADER",
                        "leader",
                        {
                            leaderIndex: gameEnv.players[playerId]?.deck?.currentLeaderIdx || 0,
                            isInjectedState: true
                        }
                    );
                    
                    console.log(`   ✅ Recorded leader play: ${leader.id} for ${playerId}`);
                }
            }
        }
        
        // STEP 3: Run unified effect simulation for all plays (including leaders)
        // ===================================================================
        // This is where the magic happens! The EffectSimulator replays the entire 
        // play sequence (including the PLAY_LEADER actions we just recorded) and 
        // calculates ALL effects including:
        // - Zone restrictions from leaders (e.g., Trump's TOP zone = [右翼, 自由, 經濟])
        // - Power bonuses/penalties from leaders 
        // - Cross-player effects (e.g., Powell nullifying opponent's economic cards)
        // - Card abilities and interactions
        //
        // The result is a 'computedState' object with all effects calculated
        if (gameEnv.playSequence.plays.length > 0) {
            console.log('   🔄 Running unified effect simulation for all plays...');
            
            try {
                // UNIFIED EFFECT SIMULATION: All effects applied directly to gameEnv.players[].fieldEffects
                // No separate computedState needed - single source of truth approach
                await this.effectSimulator.simulateCardPlaySequence(gameEnv);
                
                console.log('   ✅ Unified effect simulation completed - all effects in gameEnv.players[].fieldEffects');
            } catch (error) {
                console.error('ERROR in simulateCardPlaySequence:', error.message);
                console.error('Stack trace:', error.stack);
                console.error('gameEnv.playSequence.plays:', gameEnv.playSequence.plays);
                throw error; // Re-throw to maintain error propagation
            }
        } else {
            console.log('   ℹ️ No plays found in sequence - effects simulation skipped');
        }

        // Create new game with properly initialized state
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

    /**
     * 🎯 PHASE 1: Updated selectCard method using new CardSelectionHandler
     * 
     * This method now delegates to the CardSelectionHandler through processAction
     * for consistent switch-case routing and better maintainability
     */
    async selectCard(req) {
        console.log(`🎯 GameLogic: Processing selectCard request with new CardSelectionHandler`);
        
        const { selectionId, selectedCardIds, playerId, gameId } = req.body;
        
        // ===== STEP 1: VALIDATE REQUIRED PARAMETERS =====
        if (!selectionId || !selectedCardIds || !playerId || !gameId) {
            console.log(`❌ Missing required parameters`);
            throw new Error('Missing required parameters: selectionId, selectedCardIds, playerId, gameId');
        }

        console.log(`📋 Request details:`, {
            selectionId,
            selectedCardCount: selectedCardIds.length,
            playerId,
            gameId
        });

        // ===== STEP 2: LOAD GAME DATA =====
        const gameData = await this.readJSONFileAsync(gameId);
        if (!gameData) {
            console.log(`❌ Game not found: ${gameId}`);
            throw new Error('Game not found');
        }

        // ===== STEP 3: VALIDATE SELECTION EXISTS =====
        if (!gameData.gameEnv.pendingCardSelections || 
            !gameData.gameEnv.pendingCardSelections[selectionId]) {
            console.log(`❌ Invalid or expired selection: ${selectionId}`);
            throw new Error('Invalid or expired card selection');
        }

        const selection = gameData.gameEnv.pendingCardSelections[selectionId];
        console.log(`📋 Selection details:`, {
            selectionType: selection.selectionType,
            selectCount: selection.selectCount,
            effectType: selection.effectType,
            playerId: selection.playerId
        });

        // ===== STEP 4: VALIDATE PLAYER AUTHORIZATION =====
        if (selection.playerId !== playerId) {
            console.log(`❌ Player ${playerId} not authorized for selection ${selectionId}`);
            throw new Error('You are not authorized to complete this selection');
        }

        // ===== STEP 5: PROCESS THROUGH NEW CARD SELECTION HANDLER =====
        console.log(`🎯 Delegating to CardSelectionHandler via processAction`);
        
        // Create SelectCard action for the new routing system
        const selectCardAction = {
            type: 'SelectCard',
            selectionId: selectionId,
            selectedCardIds: selectedCardIds
        };

        // Process through mozGamePlay's new routing system
        const updatedGameEnv = await this.mozGamePlay.processAction(
            gameData.gameEnv, 
            playerId, 
            selectCardAction
        );

        // ===== STEP 6: HANDLE PROCESSING ERRORS =====
        if (updatedGameEnv.error) {
            console.log(`❌ Selection processing failed: ${updatedGameEnv.error}`);
            throw new Error(updatedGameEnv.error);
        }

        // ===== STEP 7: SAVE UPDATED GAME STATE =====
        console.log(`💾 Saving updated game state`);
        gameData.gameEnv = updatedGameEnv;
        const updatedGameData = this.addUpdateUUID(gameData);
        await this.saveOrCreateGame(updatedGameData, gameId);

        // ===== STEP 8: RETURN SUCCESS RESPONSE =====
        console.log(`✅ Card selection completed successfully via CardSelectionHandler`);
        return {
            success: true,
            gameEnv: updatedGameData.gameEnv,
            selectionCompleted: true,
            message: `Successfully processed ${selection.selectionType} selection via CardSelectionHandler`
        };
    }


    async getTestScenario(req) {
        const fs = require('fs');
        const path = require('path');
        const { scenarioPath } = req.query;
        if (!scenarioPath) {
            throw new Error('scenarioPath query parameter is required');
        }
        
        // ✅ HARDCODED SUPPORT: Handle simple_test gameId
        if (scenarioPath === 'simple_test') {
            console.log(`🎯 GameLogic: Returning hardcoded simple_test gameEnv`);
            return this.getSimpleTestGameEnv();
        }
        
        const baseDir = path.resolve(__dirname, '../../../shared/testScenarios/gameStates');
        let relPath = scenarioPath.endsWith('.json') ? scenarioPath : scenarioPath + '.json';
        const fullPath = path.join(baseDir, relPath);
        try {
            await fs.promises.access(fullPath, fs.constants.F_OK);
        } catch (e) {
            throw new Error('Scenario not found');
        }
        const data = await fs.promises.readFile(fullPath, 'utf-8');
        const json = JSON.parse(data);
        
        // ✅ MODIFICATION: Return the gameEnv from the test scenario
        // Support both 'initialGameEnv' and 'gameEnv' properties
        if (json.initialGameEnv) {
            console.log(`🎯 GameLogic: Returning initialGameEnv from test scenario: ${scenarioPath}`);
            return {
                    "gameId": "simple_test",
                    "gameEnv": json.initialGameEnv,
                    "lastUpdate": "2025-07-24T12:14:38.496Z"
            }
        } else if (json.gameEnv) {
            console.log(`🎯 GameLogic: Returning gameEnv from test scenario: ${scenarioPath}`);
            return json.gameEnv;
        } else {
            // Fallback: if no gameEnv property, return the entire JSON (backward compatibility)
            console.log(`⚠️ GameLogic: No gameEnv found in scenario, returning full JSON: ${scenarioPath}`);
            return json;
        }
    }

    getSimpleTestGameEnv() {
        // ✅ HARDCODED: Complete gameEnv for simple_test scenario
        return {
            "phase": "MAIN_PHASE",
            "round": 1,
            "gameStarted": true,
            "currentPlayer": "playerId_1",
            "currentTurn": 0,
            "firstPlayer": 0,
            "players": {
                "playerId_1": {
                    "id": "playerId_1",
                    "name": "Player 1",
                    "deck": {
                        "hand": [
                            "c-1",
                            "h-1",
                            "c-2",
                            "c-3",
                            "c-4"
                        ],
                        "mainDeck": [
                            "c-5",
                            "c-6",
                            "c-7",
                            "c-8",
                            "c-9",
                            "c-10",
                            "c-11",
                            "c-12",
                            "c-13",
                            "c-14",
                            "c-15",
                            "c-16",
                            "h-3",
                            "h-4",
                            "sp-1",
                            "sp-2",
                            "sp-3"
                        ],
                        "leader": [
                            "s-1",
                            "s-2",
                            "s-3",
                            "s-4"
                        ],
                        "currentLeaderIdx": 0
                    },
                    "isReady": true,
                    "redraw": 1,
                    "turnAction": [],
                    "playerPoint": 0,
                    "fieldEffects": {
                        "zoneRestrictions": {
                            "TOP": [
                                "右翼",
                                "自由",
                                "經濟"
                            ],
                            "LEFT": [
                                "右翼",
                                "自由",
                                "愛國者"
                            ],
                            "RIGHT": [
                                "右翼",
                                "愛國者",
                                "經濟"
                            ],
                            "HELP": [
                                "ALL"
                            ],
                            "SP": [
                                "ALL"
                            ]
                        },
                        "activeEffects": [
                            {
                                "effectId": "s-1_trump_rightWing_patriot_boost",
                                "source": "s-1",
                                "sourcePlayerId": "playerId_1",
                                "type": "powerBoost",
                                "target": {
                                    "scope": "SELF",
                                    "playerId": "playerId_1",
                                    "zones": [
                                        "top",
                                        "left",
                                        "right"
                                    ],
                                    "gameTypes": [
                                        "右翼",
                                        "愛國者"
                                    ]
                                },
                                "value": 45,
                                "priority": 0,
                                "unremovable": false,
                                "isEnabled": true,
                                "createdAt": 1753352319449,
                                "effectData": {}
                            }
                        ],
                        "specialEffects": {},
                        "calculatedPowers": {},
                        "disabledCards": [],
                        "victoryPointModifiers": 0
                    }
                },
                "playerId_2": {
                    "id": "playerId_2",
                    "name": "Player 2",
                    "deck": {
                        "hand": [
                            "h-2",
                            "c-17",
                            "c-18",
                            "c-19",
                            "c-20"
                        ],
                        "mainDeck": [
                            "c-21",
                            "c-22",
                            "c-23",
                            "c-24",
                            "c-25",
                            "c-26",
                            "c-27",
                            "c-28",
                            "c-29",
                            "c-30",
                            "c-31",
                            "c-32",
                            "c-33",
                            "h-5",
                            "h-6",
                            "h-7",
                            "sp-4",
                            "sp-5",
                            "sp-6"
                        ],
                        "leader": [
                            "s-2",
                            "s-3",
                            "s-4",
                            "s-5"
                        ],
                        "currentLeaderIdx": 0
                    },
                    "isReady": true,
                    "redraw": 1,
                    "turnAction": [],
                    "playerPoint": 0,
                    "fieldEffects": {
                        "zoneRestrictions": {
                            "TOP": [
                                "左翼",
                                "自由",
                                "經濟",
                                "右翼",
                                "愛國者"
                            ],
                            "LEFT": [
                                "左翼",
                                "自由",
                                "經濟",
                                "右翼",
                                "愛國者"
                            ],
                            "RIGHT": [
                                "左翼",
                                "自由",
                                "經濟",
                                "右翼",
                                "愛國者"
                            ],
                            "HELP": [
                                "ALL"
                            ],
                            "SP": [
                                "ALL"
                            ]
                        },
                        "activeEffects": [
                            {
                                "effectId": "s-2_biden_all_boost",
                                "source": "s-2",
                                "sourcePlayerId": "playerId_2",
                                "type": "powerBoost",
                                "target": {
                                    "scope": "SELF",
                                    "playerId": "playerId_2",
                                    "zones": [
                                        "top",
                                        "left",
                                        "right"
                                    ]
                                },
                                "value": 40,
                                "priority": 0,
                                "unremovable": false,
                                "isEnabled": true,
                                "createdAt": 1753352319450,
                                "effectData": {}
                            }
                        ],
                        "specialEffects": {},
                        "calculatedPowers": {},
                        "disabledCards": [],
                        "victoryPointModifiers": 0
                    }
                }
            },
            "zones": {
                "playerId_1": {
                    "leader": {
                        "id": "s-1",
                        "name": "特朗普",
                        "cardType": "leader",
                        "gameType": "右翼",
                        "initialPoint": 110,
                        "level": 7,
                        "rarity": "legendary",
                        "zoneCompatibility": {
                            "top": [
                                "右翼",
                                "自由",
                                "經濟"
                            ],
                            "left": [
                                "右翼",
                                "自由",
                                "愛國者"
                            ],
                            "right": [
                                "右翼",
                                "愛國者",
                                "經濟"
                            ]
                        },
                        "effects": {
                            "description": "全部召喚出來的角色擁有右翼或愛國者屬性能力值 +45。如對方領袖卡為「鮑威爾」，我方召喚出來擁有經濟屬性的原能力值變成 0",
                            "rules": [
                                {
                                    "id": "trump_rightWing_patriot_boost",
                                    "type": "continuous",
                                    "trigger": {
                                        "event": "always",
                                        "conditions": []
                                    },
                                    "target": {
                                        "owner": "self",
                                        "zones": [
                                            "top",
                                            "left",
                                            "right"
                                        ],
                                        "filters": [
                                            {
                                                "type": "gameTypeOr",
                                                "values": [
                                                    "右翼",
                                                    "愛國者"
                                                ]
                                            }
                                        ]
                                    },
                                    "effect": {
                                        "type": "powerBoost",
                                        "value": 45
                                    }
                                },
                                {
                                    "id": "trump_vs_powell_economy_nerf",
                                    "type": "continuous",
                                    "trigger": {
                                        "event": "always",
                                        "conditions": [
                                            {
                                                "type": "opponentLeader",
                                                "value": "鮑威爾"
                                            }
                                        ]
                                    },
                                    "target": {
                                        "owner": "self",
                                        "zones": [
                                            "top",
                                            "left",
                                            "right"
                                        ],
                                        "filters": [
                                            {
                                                "type": "gameType",
                                                "value": "經濟"
                                            }
                                        ]
                                    },
                                    "effect": {
                                        "type": "setPower",
                                        "value": 0
                                    }
                                }
                            ]
                        }
                    },
                    "top": [],
                    "left": [],
                    "right": [],
                    "help": [],
                    "sp": []
                },
                "playerId_2": {
                    "leader": {
                        "id": "s-2",
                        "name": "拜登",
                        "cardType": "leader",
                        "gameType": "左翼",
                        "initialPoint": 100,
                        "level": 7,
                        "rarity": "legendary",
                        "zoneCompatibility": {
                            "top": [
                                "左翼",
                                "自由",
                                "經濟",
                                "右翼",
                                "愛國者"
                            ],
                            "left": [
                                "左翼",
                                "自由",
                                "經濟",
                                "右翼",
                                "愛國者"
                            ],
                            "right": [
                                "左翼",
                                "自由",
                                "經濟",
                                "右翼",
                                "愛國者"
                            ]
                        },
                        "effects": {
                            "description": "全部召喚出來的角色能力值 +40",
                            "rules": [
                                {
                                    "id": "biden_all_boost",
                                    "type": "continuous",
                                    "trigger": {
                                        "event": "always",
                                        "conditions": []
                                    },
                                    "target": {
                                        "owner": "self",
                                        "zones": [
                                            "top",
                                            "left",
                                            "right"
                                        ],
                                        "filters": []
                                    },
                                    "effect": {
                                        "type": "powerBoost",
                                        "value": 40
                                    }
                                }
                            ]
                        }
                    },
                    "top": [],
                    "left": [],
                    "right": [],
                    "help": [],
                    "sp": []
                }
            },
            "gameEvents": [],
            "lastEventId": 0,
            "pendingPlayerAction": null,
            "pendingCardSelections": {},
            "playSequence": {
                "globalSequence": 2,
                "plays": [
                    {
                        "sequenceId": 1,
                        "playerId": "playerId_1",
                        "cardId": "s-1",
                        "action": "PLAY_LEADER",
                        "zone": "leader",
                        "data": {
                            "leaderIndex": 0,
                            "isInjectedState": true
                        },
                        "timestamp": "2025-07-24T10:18:39.445Z",
                        "turnNumber": 0,
                        "phaseWhenPlayed": "MAIN_PHASE"
                    },
                    {
                        "sequenceId": 2,
                        "playerId": "playerId_2",
                        "cardId": "s-2",
                        "action": "PLAY_LEADER",
                        "zone": "leader",
                        "data": {
                            "leaderIndex": 0,
                            "isInjectedState": true
                        },
                        "timestamp": "2025-07-24T10:18:39.447Z",
                        "turnNumber": 0,
                        "phaseWhenPlayed": "MAIN_PHASE"
                    }
                ]
            }
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
        if (drawPhaseCompleted && gameData.gameEnv.phase === GamePhase.DRAW_PHASE) {
            updatePhase(gameData.gameEnv, GamePhase.MAIN_PHASE);
            
            // Add main phase start event
            this.mozGamePlay.addGameEvent(gameData.gameEnv, 'PHASE_CHANGE', {
                phase: GamePhase.MAIN_PHASE,
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

        return {
            success: true,
            gameEnv: updatedGameData.gameEnv
        };
    }
}

module.exports = new GameLogic();