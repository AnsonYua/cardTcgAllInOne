const mozDeckHelper = require('./mozDeckHelper');
const mozPhaseManager = require('./mozPhaseManager');
const CardEffectManager = require('../services/CardEffectManager');
const FieldEffectProcessor = require('../services/FieldEffectProcessor');
const { getPlayerFromGameEnv, getPlayerField } = require('../utils/gameUtils');
const CardInfoUtils = require('../services/CardInfoUtils');

// UNIFIED EFFECT SYSTEM: Import for leader and card effect processing
const playSequenceManager = require('../services/PlaySequenceManager');
const effectSimulator = require('../services/EffectSimulator');
const { json } = require('express');
const TurnPhase = {
    START_REDRAW: 'START_REDRAW',
    DRAW_PHASE: 'DRAW_PHASE',
    MAIN_PHASE: 'MAIN_PHASE',
    SP_PHASE: 'SP_PHASE',
    END_SUMMONER_BATTLE: 'END_SUMMONER_BATTLE',
    MAIN_PHASE_1: 'MAIN_PHASE_1',
    BATTLE_PHASE: 'BATTLE_PHASE',
    MAIN_PHASE_2: 'MAIN_PHASE_2',
    END_PHASE: 'END_PHASE',
    GAME_END: 'GAME_END',
    END_LEADER_BATTLE: 'END_LEADER_BATTLE'
};

class mozGamePlay {
    constructor() {
        this.cardEffectManager = CardEffectManager;
        this.cardInfoUtils = CardInfoUtils;
        this.fieldEffectProcessor = FieldEffectProcessor;
        
        // UNIFIED EFFECT SYSTEM: Dependencies for replay-based effect calculation
        // NOTE: These are injected by GameLogic.js during initialization to ensure proper dependency setup
        this.playSequenceManager = null;
        this.effectSimulator = null;
    }

    // Helper methods for unified format compatibility
    getPlayerHand(gameEnv, playerId) {
        if (!gameEnv.players) {
            throw new Error('Game environment must have unified structure with gameEnv.players');
        }
        return gameEnv.players[playerId].deck.hand;
    }

    getPlayerMainDeck(gameEnv, playerId) {
        if (!gameEnv.players) {
            throw new Error('Game environment must have unified structure with gameEnv.players');
        }
        return gameEnv.players[playerId].deck.mainDeck;
    }

    getPlayerDeck(gameEnv, playerId) {
        if (!gameEnv.players) {
            throw new Error('Game environment must have unified structure with gameEnv.players');
        }
        return gameEnv.players[playerId].deck;
    }

    setPlayerHand(gameEnv, playerId, hand) {
        if (!gameEnv.players) {
            throw new Error('Game environment must have unified structure with gameEnv.players');
        }
        gameEnv.players[playerId].deck.hand = hand;
    }

    setPlayerMainDeck(gameEnv, playerId, mainDeck) {
        if (!gameEnv.players) {
            throw new Error('Game environment must have unified structure with gameEnv.players');
        }
        gameEnv.players[playerId].deck.mainDeck = mainDeck;
    }

    getPlayerField(gameEnv, playerId) {
        if (!gameEnv.zones) {
            throw new Error('Game environment must have unified structure with gameEnv.zones');
        }
        return gameEnv.zones[playerId];
    }

    getPlayerZone(gameEnv, playerId, zone) {
        const field = this.getPlayerField(gameEnv, playerId);
        return field ? field[zone] : null;
    }

    getPlayerData(gameEnv, playerId) {
        if (!gameEnv.players) {
            throw new Error('Game environment must have unified structure with gameEnv.players');
        }
        return gameEnv.players[playerId];
    }

    // Event Management System
    initializeEventSystem(gameEnv) {
        if (!gameEnv.gameEvents) {
            gameEnv.gameEvents = [];
        }
        if (!gameEnv.lastEventId) {
            gameEnv.lastEventId = 0;
        }
        return gameEnv;
    }

    addGameEvent(gameEnv, eventType, eventData = {}) {
        this.initializeEventSystem(gameEnv);
        
        const timestamp = Date.now();
        const eventId = `event_${timestamp}_${gameEnv.lastEventId + 1}`;
        
        const event = {
            id: eventId,
            type: eventType,
            data: eventData,
            timestamp: timestamp,
            expiresAt: timestamp + 3000, // 3 seconds
            frontendProcessed: false
        };
        
        gameEnv.gameEvents.push(event);
        gameEnv.lastEventId = gameEnv.lastEventId + 1;
        
        // Clean expired events
        this.cleanExpiredEvents(gameEnv);
        
        return event;
    }

    cleanExpiredEvents(gameEnv) {
        if (!gameEnv.gameEvents) return;
        
        const now = Date.now();
        gameEnv.gameEvents = gameEnv.gameEvents.filter(event => 
            event.expiresAt > now || !event.frontendProcessed
        );
    }

    markEventProcessed(gameEnv, eventId) {
        if (!gameEnv.gameEvents) return false;
        
        const event = gameEnv.gameEvents.find(e => e.id === eventId);
        if (event) {
            event.frontendProcessed = true;
            return true;
        }
        return false;
    }

    addErrorEvent(gameEnv, errorType, errorMessage, playerId = null) {
        return this.addGameEvent(gameEnv, 'ERROR_OCCURRED', {
            errorType: errorType,
            message: errorMessage,
            playerId: playerId
        });
    }

    updateInitialGameEnvironment(gameEnv){
        // Initialize event system
        this.initializeEventSystem(gameEnv);
        
        // decide who goes first
        const leaderList = []
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        const leaderRevealed = {};
        
        for (let playerId in playerList){
            let leader = this.cardInfoUtils.getCurrentLeader(gameEnv, playerList[playerId]);
            leaderList.push(leader);
            leaderRevealed[playerList[playerId]] = {
                cardId: leader.cardId,
                name: leader.name,
                initialPoint: leader.initialPoint
            };
        }
        
        var firstPlayer = 0; 
        if (leaderList[1].initialPoint>leaderList[0].initialPoint){
            firstPlayer = 1;
        }else if (leaderList[1].initialPoint===leaderList[0].initialPoint){
            firstPlayer = Math.floor(Math.random() * 2);
        }
        firstPlayer = 0;
        gameEnv["firstPlayer"] = firstPlayer;
        mozPhaseManager.setCurrentPhase(TurnPhase.START_REDRAW)
        gameEnv["phase"] = mozPhaseManager.currentPhase;
        for (let playerId in playerList){
            const { getPlayerData } = require('../utils/gameUtils');
            const playerData = getPlayerData(gameEnv, playerList[playerId]);
            playerData.redraw = 0;
        }
        
        // Add game started event
        this.addGameEvent(gameEnv, 'GAME_STARTED', {
            players: playerList,
            firstPlayer: playerList[firstPlayer],
            leaderRevealed: leaderRevealed
        });
        
        // Add initial hand dealt events for each player
        for (let playerId of playerList) {
            this.addGameEvent(gameEnv, 'INITIAL_HAND_DEALT', {
                playerId: playerId,
                handSize: this.getPlayerHand(gameEnv, playerId).length
            });
        }
        
        return gameEnv;
    }
    
    async redrawInBegining(gameEnvInput,playerId,isRedraw){
        const { getPlayerData } = require('../utils/gameUtils');
        var gameEnv = gameEnvInput;
        const playerData = getPlayerData(gameEnv, playerId);
        
        if(playerData.redraw == 0){
            playerData.redraw = 1;
            
            // Add player ready event
            this.addGameEvent(gameEnv, 'PLAYER_READY', {
                playerId: playerId,
                redrawRequested: isRedraw
            });
            
            if (isRedraw){
                const {hand,mainDeck} =  await mozDeckHelper.reshuffleForPlayer(playerId);
                playerData.deck.hand = hand;
                playerData.deck.mainDeck = mainDeck;
                
                // Add hand redrawn event
                this.addGameEvent(gameEnv, 'HAND_REDRAWN', {
                    playerId: playerId,
                    newHandSize: hand.length
                });
            }
        }
        // Note: Field initialization is now handled in GameLogic.startReady() when both players are ready
        // This method only handles the redraw logic during the initial ready phase
        return gameEnv;
    }

    /**
     * Processes a player action in the game
     * This is the MAIN GAME ENGINE that handles all player actions including:
     * - Card placement (face-up and face-down)
     * - Action validation and error handling
     * - Card effect processing
     * - Turn management and phase transitions
     * - Battle resolution
     * 
     * @param {Object} gameEnvInput - Current game environment state
     * @param {string} playerId - ID of the player making the action
     * @param {Object} action - Action object containing type, card_idx, field_idx
     * @returns {Object} Updated game environment or error object
     */
    async processAction(gameEnvInput, playerId, action) {
        var gameEnv = gameEnvInput;
        
        // ===== SECTION 1: PENDING ACTION BLOCKING =====
        // Check if there's a pending player action that blocks normal gameplay
        // This prevents players from making other actions while card selection is required
        if (gameEnv.pendingPlayerAction) {
            const pendingAction = gameEnv.pendingPlayerAction;
            
            // If card selection is pending, block all other actions
            if (pendingAction.type === 'cardSelection') {
                const selection = gameEnv.pendingCardSelections[pendingAction.selectionId];
                if (selection) {
                    if (selection.playerId === playerId) {
                        // Current player needs to complete their card selection first
                        this.addErrorEvent(gameEnv, 'CARD_SELECTION_PENDING', `You must complete your card selection first. Select ${selection.selectCount} card(s).`, playerId);
                        return this.throwError(`You must complete your card selection first. Select ${selection.selectCount} card(s).`);
                    } else {
                        // Other player is waiting for the current player to complete selection
                        this.addErrorEvent(gameEnv, 'WAITING_FOR_PLAYER', `Waiting for ${selection.playerId} to complete card selection. Please wait.`, playerId);
                        return this.throwError(`Waiting for ${selection.playerId} to complete card selection. Please wait.`);
                    }
                }
            }
            
            // Generic blocking for any pending action
            this.addErrorEvent(gameEnv, 'GAME_BLOCKED', `Game is waiting for player action.`, playerId);
            return this.throwError(`Game is waiting for player action.`);
        }
        
        // ===== SECTION 2: CARD PLAY ACTION HANDLING =====
        // Handle card play actions (face up or face down)
        if (action["type"] == "PlayCard" || action["type"] == "PlayCardBack") {
            var isPlayInFaceDown = action["type"] == "PlayCardBack";
            const positionDict = ["top", "left", "right", "help", "sp"];
            
            // ===== SECTION 2A: BASIC VALIDATION =====
            // Validate field position (0-4 for top, left, right, help, sp)
            if (action["field_idx"] >= positionDict.length) {
                this.addErrorEvent(gameEnv, 'INVALID_POSITION', "position out of range", playerId);
                return this.throwError("position out of range");
            }
            
            const playPos = positionDict[action["field_idx"]];
            var hand = [...this.getPlayerHand(gameEnv, playerId)];
            
            // Validate card index in hand (prevent playing non-existent cards)
            if (action["card_idx"] >= hand.length) {
                this.addErrorEvent(gameEnv, 'INVALID_CARD_INDEX', "hand card out of range", playerId);
                return this.throwError("hand card out of range");
            }
            
            // Get card details from deck manager
            const cardToPlay = hand[action["card_idx"]];
            console.log(`DEBUG: About to get card details for: ${cardToPlay}`);
            const cardDetails = mozDeckHelper.getDeckCardDetails(cardToPlay);
            console.log(`DEBUG: Card details received:`, cardDetails);
            
            if (!cardDetails) {
                this.addErrorEvent(gameEnv, 'CARD_NOT_FOUND', "Card not found", playerId);
                return this.throwError("Card not found");
            }

            // ===== SECTION 2B: ADVANCED PLACEMENT RESTRICTIONS =====
            // Check placement restrictions (basic validation, leader effects, card effects)
            // Face-down cards bypass all restrictions since opponent cannot see what's being played
            if (!isPlayInFaceDown) {
                // 1. Basic card type validation
                if (cardDetails.cardType === 'character') {
                    // Characters can only be placed in top, left, or right
                    if (playPos === 'help' || playPos === 'sp') {
                        this.addErrorEvent(gameEnv, 'ZONE_COMPATIBILITY_ERROR', `Character cards cannot be placed in ${playPos} position`, playerId);
                        return this.throwError(`Character cards cannot be placed in ${playPos} position`);
                    }
                }

                // 2. Leader zone restrictions validation (compatibility with unified system)
                // NOTE: Zone restrictions are set by EffectSimulator during PLAY_LEADER processing
                // This method validates against the computed restrictions from the unified system
                const fieldEffectCheck = await this.fieldEffectProcessor.validateCardPlacementWithFieldEffects(
                    gameEnv,
                    playerId,
                    cardDetails,
                    playPos
                );

                if (!fieldEffectCheck.canPlace) {
                    this.addErrorEvent(gameEnv, 'FIELD_EFFECT_RESTRICTION', fieldEffectCheck.reason, playerId);
                    return this.throwError(fieldEffectCheck.reason);
                }

                // 3. Check card effect restrictions (help cards, character cards)
                const { getPlayerField } = require('../utils/gameUtils');
                const playerField = getPlayerField(gameEnv, playerId);
                if (playerField) {
                    // Check help card restrictions - FIXED to handle proper card structure
                    const helpCards = playerField.help || [];
                    console.log(`DEBUG: Checking ${helpCards.length} help cards for player ${playerId}`);
                    for (const helpCard of helpCards) {
                        console.log(`DEBUG: Help card structure:`, helpCard);
                        
                        // Handle both legacy and new card structures safely
                        let cardData = null;
                        if (helpCard.cardDetails && Array.isArray(helpCard.cardDetails) && helpCard.cardDetails.length > 0) {
                            cardData = helpCard.cardDetails[0];
                        } else if (helpCard.id) {
                            // Direct card object
                            cardData = helpCard;
                        } else {
                            console.warn(`Skipping help card with invalid structure:`, helpCard);
                            continue;
                        }

                        // Check for placement restrictions from help card effects
                        if (cardData.effects && cardData.effects.rules) {
                            for (const rule of cardData.effects.rules) {
                                // Note: Current card structure uses 'effects.rules', not 'effectRules'
                                if (rule.effect && rule.effect.type === 'preventPlay') {
                                    console.log(`Found placement restriction rule in help card ${cardData.name}`);
                                    // TODO: Implement proper rule evaluation when needed
                                    // For now, help cards don't block placement
                                }
                            }
                        }
                    }

                    // Check character card restrictions - FIXED to handle proper card structure
                    const characterCards = playerField[playPos] || [];
                    for (const characterCard of characterCards) {
                        console.log(`DEBUG: Character card structure:`, characterCard);
                        
                        // Handle both legacy and new card structures safely
                        let cardData = null;
                        if (characterCard.cardDetails && Array.isArray(characterCard.cardDetails) && characterCard.cardDetails.length > 0) {
                            cardData = characterCard.cardDetails[0];
                        } else if (characterCard.id) {
                            // Direct card object
                            cardData = characterCard;
                        } else {
                            console.warn(`Skipping character card with invalid structure:`, characterCard);
                            continue;
                        }

                        // Check for placement restrictions from character card effects
                        if (cardData.effects && cardData.effects.rules) {
                            for (const rule of cardData.effects.rules) {
                                // Note: Current card structure uses 'effects.rules', not 'effectRules'
                                if (rule.effect && rule.effect.type === 'preventPlay') {
                                    console.log(`Found placement restriction rule in character card ${cardData.name}`);
                                    // TODO: Implement proper rule evaluation when needed
                                    // For now, character cards don't block placement in same zone
                                }
                            }
                        }
                    }
                }
            }

            // ===== SECTION 2C: PHASE AND CARD TYPE VALIDATION =====
            // Validate card type and position compatibility based on game rules
            if (isPlayInFaceDown) {
                // Face-down placement rules: Any card can be played face-down for strategic purposes
                // Face-down cards have no power, no effects, and don't contribute to combos
                // Phase restriction: No face-down cards can be played in SP zone during MAIN_PHASE
                if (gameEnv["phase"] != TurnPhase.SP_PHASE && playPos == "sp") {
                    this.addErrorEvent(gameEnv, 'PHASE_RESTRICTION_ERROR', "Cannot play face-down cards in SP zone during MAIN_PHASE", playerId);
                    return this.throwError("Cannot play face-down cards in SP zone during MAIN_PHASE");
                }
                // All other face-down placements are allowed for zone filling and bluffing
            } else {
                // SP zone enforcement: During SP_PHASE, SP zone cards MUST be played face-down
                if (gameEnv["phase"] == TurnPhase.SP_PHASE && playPos == "sp") {
                    this.addErrorEvent(gameEnv, 'SP_PHASE_RESTRICTION', "Cards in SP zone must be played face-down during SP phase", playerId);
                    return this.throwError("Cards in SP zone must be played face-down during SP phase");
                }
                
                // Face-up card placement validation by card type
                if (cardDetails["cardType"] == "character") {
                    // Character cards can only go in top/left/right zones (battle zones)
                    if (playPos == "help" || playPos == "sp") {
                        this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "Can't play character card in utility zones", playerId);
                        return this.throwError("Can't play character card in utility zones");
                    }
                    // Ensure only one character per zone (no stacking)
                    if (playPos == "top" || playPos == "left" || playPos == "right") {
                        const { getPlayerField } = require('../utils/gameUtils');
                        const playerField = getPlayerField(gameEnv, playerId);
                        if (await this.monsterInField(playerField[playPos])) {
                            this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "Character already in this position", playerId);
                            return this.throwError("Character already in this position");
                        }
                    }
                } else if (cardDetails["cardType"] == "help") {
                    // Help cards provide utility effects, only one allowed per player
                    if (playPos != "help") {
                        this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "Help cards can only be played in help zone", playerId);
                        return this.throwError("Help cards can only be played in help zone");
                    }
                    const { getPlayerField } = require('../utils/gameUtils');
                    const playerField = getPlayerField(gameEnv, playerId);
                    if (playerField[playPos].length > 0) {
                        this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "Help zone already occupied", playerId);
                        return this.throwError("Help zone already occupied");
                    }
                } else if (cardDetails["cardType"] == "sp") {
                    // SP cards can only be played during SP_PHASE (special phase)
                    if (gameEnv["phase"] != TurnPhase.SP_PHASE) {
                        this.addErrorEvent(gameEnv, 'PHASE_RESTRICTION_ERROR', "SP cards can only be played during SP phase", playerId);
                        return this.throwError("SP cards can only be played during SP phase");
                    }
                    // SP cards are special powerful effects, only one allowed per player
                    if (playPos != "sp") {
                        this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "SP cards can only be played in SP zone", playerId);
                        return this.throwError("SP cards can only be played in SP zone");
                    }
                    const { getPlayerField } = require('../utils/gameUtils');
                    const playerField = getPlayerField(gameEnv, playerId);
                    if (playerField[playPos].length > 0) {
                        this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "SP zone already occupied", playerId);
                        return this.throwError("SP zone already occupied");
                    }
                }
            }

            // ===== SECTION 2D: CARD PLACEMENT AND STATE UPDATE =====
            // Create card object for field placement with all necessary metadata
            var cardObj = {
                "card": hand.splice(action["card_idx"], 1),        // Remove card from hand
                "cardDetails": [cardDetails],                      // Store card data for effects
                "isBack": [isPlayInFaceDown],                     // Track if face down (for battle calculations)
                "valueOnField": isPlayInFaceDown ? 0 : cardDetails["power"]  // Power for calculations (face-down = 0)
            };

            // Update game state with card placement
            const { getPlayerData, getPlayerField } = require('../utils/gameUtils');
            const playerData = getPlayerData(gameEnv, playerId);
            const playerField = getPlayerField(gameEnv, playerId);
            
            this.setPlayerHand(gameEnv, playerId, hand);   // Update hand (card removed)
            playerField[playPos].push(cardObj);       // Place card on field
            action["selectedCard"] = cardObj;                     // Track action details for history
            action["turn"] = gameEnv["currentTurn"];
            this.getPlayerData(gameEnv, playerId).turnAction.push(action);         // Record action history
            
            // ===== SECTION 2E: EVENT TRACKING =====
            // Add successful card placement event for frontend updates
            this.addGameEvent(gameEnv, 'CARD_PLAYED', {
                playerId: playerId,
                card: {
                    cardId: cardDetails.cardId,
                    name: cardDetails.name,
                    cardType: cardDetails.cardType,
                    power: cardDetails.power,
                    gameType: cardDetails.gameType,
                    traits: cardDetails.traits || []
                },
                zone: playPos,
                isFaceDown: isPlayInFaceDown,
                turn: gameEnv["currentTurn"]
            });
            
            // Add zone filled event for UI updates
            this.addGameEvent(gameEnv, 'ZONE_FILLED', {
                playerId: playerId,
                zone: playPos,
                cardType: cardDetails.cardType,
                isFaceDown: isPlayInFaceDown
            });

            // ===== SECTION 2F: IMMEDIATE CARD EFFECT PROCESSING =====
            // Process immediate card effects - only for face-up cards
            // SP zone cards do NOT process effects immediately - they wait for reveal phase
            if (!isPlayInFaceDown && playPos !== "sp") {
                let effectResult = null;
                if (cardDetails["cardType"] == "character") {
                    // Character summon effects (e.g., draw cards, search deck, boost power)
                    effectResult = await this.processCharacterSummonEffects(gameEnv, playerId, cardDetails);
                } else if (cardDetails["cardType"] == "help") {
                    // Help card play effects (e.g., discard opponent cards, boost power, search)
                    effectResult = await this.processUtilityCardEffects(gameEnv, playerId, cardDetails);
                }
                
                // UNIFIED EFFECT SYSTEM: Card play recording moved to GameLogic.processPlayerAction
                // This avoids duplicate recording and ensures proper parameter handling
                
                // Add card effect triggered event for frontend
                if (effectResult) {
                    this.addGameEvent(gameEnv, 'CARD_EFFECT_TRIGGERED', {
                        playerId: playerId,
                        cardId: cardDetails.cardId,
                        cardName: cardDetails.name,
                        effectType: cardDetails.cardType === "character" ? "onSummon" : "onPlay",
                        requiresSelection: effectResult.requiresCardSelection || false
                    });
                }
                
                // Check if card effect requires user selection (e.g., search effects)
                if (effectResult && effectResult.requiresCardSelection) {
                    // Add card selection required event
                    this.addGameEvent(gameEnv, 'CARD_SELECTION_REQUIRED', {
                        playerId: playerId,
                        selectionId: effectResult.cardSelection.selectionId,
                        eligibleCardCount: effectResult.cardSelection.eligibleCards.length,
                        selectCount: effectResult.cardSelection.selectCount,
                        cardTypeFilter: effectResult.cardSelection.cardTypeFilter
                    });
                    
                    // Return the effect result directly - it already contains the proper structure
                    // This blocks further actions until selection is completed
                    return effectResult;
                }
            }
            
            // ===== SECTION 2G: SP PHASE COMPLETION CHECK =====
            // Check if both players have filled SP zones - trigger reveal phase
            if (gameEnv["phase"] == TurnPhase.SP_PHASE && playPos == "sp") {
                const allPlayers = Object.keys(gameEnv).filter(key => key.startsWith('playerId_'));
                const allSpZonesFilled = allPlayers.every(pid => {
                    const spZone = this.getPlayerZone(gameEnv, pid, 'sp');
                    return spZone && spZone.length > 0;
                });
                
                if (allSpZonesFilled) {
                    // Add event for SP zones filled
                    this.addGameEvent(gameEnv, 'ALL_SP_ZONES_FILLED', {
                        allPlayers: allPlayers,
                        triggerPlayer: playerId
                    });
                    
                    // Trigger SP reveal and battle calculation
                    return await this.processSpRevealAndBattle(gameEnv);
                }
            }
            
            // ===== SECTION 2H: TURN AND PHASE MANAGEMENT =====
            // Recalculate player points with all active effects
            const currentPlayerData = this.getPlayerData(gameEnv, playerId);
            currentPlayerData.playerPoint = await this.calculatePlayerPoint(gameEnv, playerId);
            
            // Check if main phase is complete (all character zones + help zones filled or skipped)
            const isMainPhaseComplete = await this.checkIsMainPhaseComplete(gameEnv);
            
            if (!isMainPhaseComplete) {
                // Continue turn-based play - players still need to place character/help cards
                const oldPlayer = gameEnv.currentPlayer;
                gameEnv = await this.shouldUpdateTurn(gameEnv, playerId);
                
                // Add turn switch event if player changed
                if (gameEnv.currentPlayer !== oldPlayer) {
                    this.addGameEvent(gameEnv, 'TURN_SWITCH', {
                        oldPlayer: oldPlayer,
                        newPlayer: gameEnv.currentPlayer,
                        turn: gameEnv.currentTurn
                    });
                }
            } else {
                // Add event for main phase completion
                this.addGameEvent(gameEnv, 'ALL_MAIN_ZONES_FILLED', {
                    allPlayersComplete: true,
                    nextPhase: 'SP_PHASE'
                });
                
                // All required zones filled - prepare for battle resolution with phase skipping logic
                const oldPhase = gameEnv.phase;
                gameEnv = await this.advanceToSpPhaseOrBattle(gameEnv, playerId);
                
                // Add phase change event if phase changed
                if (gameEnv.phase !== oldPhase) {
                    this.addGameEvent(gameEnv, 'PHASE_CHANGE', {
                        oldPhase: oldPhase,
                        newPhase: gameEnv.phase,
                        reason: 'main_phase_complete'
                    });
                }
            }
        }
        return gameEnv;
    }

    

    async concludeLeaderBattleAndNewStart(gameEnvInput,playerId){
        var gameEnv = gameEnvInput;
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        var crtPlayer = playerId;
        var opponent = playerList[0];
        if(playerList[0] === playerId){
            opponent = playerList[1];
        }

        console.log("player " + crtPlayer + " "+ opponent)

        // Calculate final points for this round
        const crtPlayerData = this.getPlayerData(gameEnv, crtPlayer);
        const opponentData = this.getPlayerData(gameEnv, opponent);
        crtPlayerData.playerPoint = await this.calculatePlayerPoint(gameEnv, crtPlayer);
        opponentData.playerPoint = await this.calculatePlayerPoint(gameEnv, opponent);
        
        // Initialize victory points if not present
        if(!gameEnv[crtPlayer].hasOwnProperty("victoryPoints")){
            gameEnv[crtPlayer]["victoryPoints"] = 0;
        }
        if(!gameEnv[opponent].hasOwnProperty("victoryPoints")){
            gameEnv[opponent]["victoryPoints"] = 0;
        }
        
        // Determine round winner and award victory points
        var leaderBattleWinner = "";
        const pointDifference = crtPlayerData.playerPoint - opponentData.playerPoint;
        
        if(pointDifference > 0){
            // Current player wins
            leaderBattleWinner = crtPlayer;
            gameEnv[crtPlayer]["victoryPoints"] += pointDifference;
        } else if(pointDifference < 0){
            // Opponent wins
            leaderBattleWinner = opponent;
            gameEnv[opponent]["victoryPoints"] += Math.abs(pointDifference);
        }
        // If equal, no winner (leaderBattleWinner remains "")
        
        // Check for game end condition (50 victory points)
        if(gameEnv[crtPlayer]["victoryPoints"] >= 50){
            gameEnv["phase"] = TurnPhase.GAME_END;
            gameEnv["winner"] = crtPlayer;
            return gameEnv;
        }
        if(gameEnv[opponent]["victoryPoints"] >= 50){
            gameEnv["phase"] = TurnPhase.GAME_END;
            gameEnv["winner"] = opponent;
            return gameEnv;
        }
        this.getPlayerData(gameEnv, opponent).turnAction.push(
            this.endBattleObject(leaderBattleWinner,gameEnv["currentTurn"]));
        this.getPlayerData(gameEnv, crtPlayer).turnAction.push(
            this.endBattleObject(leaderBattleWinner,gameEnv["currentTurn"]));
        const opponentField = this.getPlayerField(gameEnv, opponent);
        const crtPlayerField = this.getPlayerField(gameEnv, crtPlayer);
        opponentField["top"] = [];
        opponentField["right"] = [];
        opponentField["left"] = [];
        crtPlayerField["top"] = [];
        crtPlayerField["right"] = [];
        crtPlayerField["left"] = [];
        crtPlayerData.playerPoint = 0;
        opponentData.playerPoint = 0;

        // Check if this was the last leader battle  
        if(this.getPlayerDeck(gameEnv, opponent).currentLeaderIdx == this.getPlayerDeck(gameEnv, opponent).leader.length-1){
            // Final leader battle completed - determine winner by victory points
            if(gameEnv[crtPlayer]["victoryPoints"] > gameEnv[opponent]["victoryPoints"]){
                gameEnv["phase"] = TurnPhase.GAME_END;
                gameEnv["winner"] = crtPlayer;
                return gameEnv; 
            } else if(gameEnv[opponent]["victoryPoints"] > gameEnv[crtPlayer]["victoryPoints"]){
                gameEnv["phase"] = TurnPhase.GAME_END;
                gameEnv["winner"] = opponent;
                return gameEnv; 
            } else {
                // Tie game - could add tiebreaker logic here
                gameEnv["phase"] = TurnPhase.GAME_END;
                gameEnv["winner"] = "draw";
                return gameEnv;
            }
        } else {
            // Move to next leader
            this.getPlayerDeck(gameEnv, opponent).currentLeaderIdx = this.getPlayerDeck(gameEnv, opponent).currentLeaderIdx + 1;
            let opponentLeader = this.cardInfoUtils.getCurrentLeader(gameEnv, opponent);
            const opponentField = this.getPlayerField(gameEnv, opponent);
            opponentField["leader"] = opponentLeader;
            
            // Record leader play for opponent
            this.playSequenceManager.recordCardPlay(
                gameEnv,
                opponent,
                opponentLeader.id,
                "PLAY_LEADER",
                "leader",
                {
                    leaderIndex: this.getPlayerDeck(gameEnv, opponent).currentLeaderIdx,
                    isRoundTransition: true
                }
            );
            
            // NOTE: Leader effects are now handled automatically by EffectSimulator through play sequence replay
            
            this.getPlayerDeck(gameEnv, crtPlayer).currentLeaderIdx = this.getPlayerDeck(gameEnv, crtPlayer).currentLeaderIdx + 1; 
            let crtLeader = this.cardInfoUtils.getCurrentLeader(gameEnv, crtPlayer);
            const crtPlayerField = this.getPlayerField(gameEnv, crtPlayer);
            crtPlayerField["leader"] = crtLeader;
            
            // Record leader play for current player
            this.playSequenceManager.recordCardPlay(
                gameEnv,
                crtPlayer,
                crtLeader.id,
                "PLAY_LEADER",
                "leader",
                {
                    leaderIndex: this.getPlayerDeck(gameEnv, crtPlayer).currentLeaderIdx,
                    isRoundTransition: true
                }
            );
            
            // UNIFIED SYSTEM: Leader effects now handled automatically by EffectSimulator
            // The PLAY_LEADER action recorded above triggers complete leader effect processing:
            // UNIFIED EFFECT SIMULATION: All effects applied directly to gameEnv.players[].fieldEffects
            // - Zone restrictions (applied directly to fieldEffects.zoneRestrictions)
            // - Power modifications (stored in fieldEffects.calculatedPowers)
            // - Cross-player effects (tracked in fieldEffects.activeEffects)
            // All processed through single source of truth - no merge needed!
            await this.effectSimulator.simulateCardPlaySequence(gameEnv);
        }
        gameEnv = await this.startNewTurn(gameEnv);
        return gameEnv;
    }
    resetField(gameEnvInput){
        var gameEnv = gameEnvInput;
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        for (let playerId in playerList){
            gameEnv[playerList[playerId]]["Field"]["top"] = [];
            gameEnv[playerList[playerId]]["Field"]["right"] = [];
            gameEnv[playerList[playerId]]["Field"]["left"] = [];
        }
        return gameEnv;
    }
    endBattleObject(winner, turn){
       if (winner == ""){
            return  {
                "turn": turn,
                "type": "EndLeaderBattle",
                "winner": "draw"
            }
       }
       return  {
            "turn": turn,
            "type": "EndLeaderBattle",
            "winner": winner
        }
    }

    async monsterInField(fieldArea){
        var monsterInField = false
        console.log("fieldArea "+JSON.stringify(fieldArea))
        for(let i = 0; i < fieldArea.length; i++){
            if(fieldArea[i]["cardDetails"][0]["cardType"] == "character"){
                monsterInField = true;
                break;
            }
        }
        return monsterInField;
    }
    async checkIsSummonBattleReady(gameEnv){
        const playerList =  mozGamePlay.getPlayerFromGameEnv(gameEnv);
        const area = ["top","left","right"];
        var allFillWithMonster = true;
       
        for (let playerListIdx in playerList){
            for (let areaIdx in area){
                const player = playerList[playerListIdx]
                const monsterArr = this.getPlayerZone(gameEnv, player, area[areaIdx]);
                var areaContainMonster = false;
                for(let monsterArrIdx in monsterArr){
                    const cardObj = monsterArr[monsterArrIdx];
                    
                    // Check if card is face down (unified format handling)
                    let isFaceDown = false;
                    if (cardObj.isBack) {
                        if (Array.isArray(cardObj.isBack) && cardObj.isBack.length > 0) {
                            // Handle array format - check if any card in the placement is face down
                            isFaceDown = cardObj.isBack.some(back => back === true);
                        } else if (typeof cardObj.isBack === 'boolean') {
                            // Handle direct boolean format
                            isFaceDown = cardObj.isBack;
                        }
                    }
                    
                    if (isFaceDown) {
                        areaContainMonster = true;
                    } else {
                        // Check if card is a character (either format)
                        const cardData = this.getCardData(cardObj);
                        if (cardData && cardData.cardType === "character") {
                            areaContainMonster = true;
                            break;
                        }
                    }
                }
                if(!areaContainMonster){
                    allFillWithMonster = false;
                }
            }
       }
       return allFillWithMonster;
    }

    /**
     * Checks if all Help zones are filled for all players
     * In normal game flow, each player should have placed 1 Help card
     * @param {Object} gameEnv - Current game environment
     * @returns {boolean} True if all Help zones are filled (or skipped due to pre-occupation)
     */
    async checkIsHelpZoneFilled(gameEnv) {
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        
        for (const playerId of playerList) {
            const helpZone = this.getPlayerZone(gameEnv, playerId, 'help');
            
            // Check if Help zone has a card (either placed normally or via search effects)
            if (!helpZone || helpZone.length === 0) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Checks if the main phase is complete and ready for SP phase/battle
     * Main phase is complete when:
     * 1. All character zones are filled (3 per player)
     * 2. All Help zones are filled (1 per player) - can be any card face-up or face-down
     * @param {Object} gameEnv - Current game environment
     * @returns {boolean} True if main phase is complete
     */
    async checkIsMainPhaseComplete(gameEnv) {
        // First check if all character zones are filled
        const isCharacterZonesFilled = await this.checkIsSummonBattleReady(gameEnv);
        if (!isCharacterZonesFilled) {
            return false;
        }

        // Check if Help zones are filled (any card face-up or face-down)
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        
        for (const playerId of playerList) {
            const helpZone = this.getPlayerZone(gameEnv, playerId, 'help');
            
            // Help zone must have at least one card (face-up or face-down)
            if (!helpZone || helpZone.length === 0) {
                return false;
            }
        }
        
        return true;
    }


    async shouldUpdateTurn(gameEnvInput,playerId){
        var gameEnv = gameEnvInput;
        

        var currentTurnActionComplete = false
        var shouldSkipTurn = false;
        
        //end currentPlayer Turn
        if(gameEnv["phase"] == TurnPhase.MAIN_PHASE){
            const playerAction = this.getPlayerData(gameEnv, playerId).turnAction;
            const currentTurn = gameEnv["currentTurn"];
            
            // Check if player played a card this turn
            for (let idx in playerAction){
                if((playerAction[idx]["type"]=="PlayCard" ||
                    playerAction[idx]["type"]=="PlayCardBack")&&
                    playerAction[idx]["turn"] == currentTurn){
                    currentTurnActionComplete = true;
                }
            }
            
            // Check if player should skip turn due to zone pre-occupation
            if (!currentTurnActionComplete) {
                shouldSkipTurn = await this.shouldPlayerSkipTurn(gameEnv, playerId);
                if (shouldSkipTurn) {
                    console.log(`Player ${playerId} automatically skipping turn - no valid placements available`);
                    currentTurnActionComplete = true;
                }
            }
        }
        
        // Don't switch turns if there's a pending card selection
        if(currentTurnActionComplete && !gameEnv.pendingPlayerAction){
            gameEnv = await this.startNewTurn(gameEnv);
        }
        return gameEnv;
    }

    /**
     * Determines if a player should automatically skip their turn
     * This happens when all their available zones are pre-occupied or they have no cards to play
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if player should skip their turn
     */
    async shouldPlayerSkipTurn(gameEnv, playerId) {
        const hand = this.getPlayerHand(gameEnv, playerId) || [];
        if (hand.length === 0) {
            return true; // No cards to play
        }

        // Check if any character zone is available
        const characterZones = ['top', 'left', 'right'];
        for (const zone of characterZones) {
            const zoneCards = this.getPlayerZone(gameEnv, playerId, zone) || [];
            const hasCharacter = await this.monsterInField(zoneCards);
            if (!hasCharacter) {
                return false; // Found available character zone
            }
        }
        
        // Check if Help zone is available (any card can be played face-down here)
        const helpZone = this.getPlayerZone(gameEnv, playerId, 'help') || [];
        if (helpZone.length === 0) {
            return false; // Help zone is available - any card can be played face-down
        }
        
        return true; // All zones are occupied, player should skip turn
    }

    async startNewTurn(gameEnvInput){
        var gameEnv = gameEnvInput;
        gameEnv["currentTurn"] = gameEnv["currentTurn"] + 1;
        const playerArr = mozGamePlay.getPlayerFromGameEnv(gameEnv)
        
        // Alternate between players based on turn number
        // Turn 0,2,4,6... = firstPlayer, Turn 1,3,5,7... = other player
        if(gameEnv["currentTurn"] % 2 === 0){
            gameEnv["currentPlayer"] = playerArr[gameEnv["firstPlayer"]];
        }else{
            const otherPlayerIdx = gameEnv["firstPlayer"] === 0 ? 1 : 0;
            gameEnv["currentPlayer"] = playerArr[otherPlayerIdx];
        }
        
        // Transition to DRAW_PHASE for the new turn player
        gameEnv["phase"] = TurnPhase.DRAW_PHASE;
        
        // Current player draws 1 card
        const currentPlayer = gameEnv["currentPlayer"];
        var hand = this.getPlayerHand(gameEnv, currentPlayer);
        var mainDeck = this.getPlayerMainDeck(gameEnv, currentPlayer);
        const result = mozDeckHelper.drawToHand(hand, mainDeck);
        this.setPlayerHand(gameEnv, currentPlayer, result["hand"]);
        this.setPlayerMainDeck(gameEnv, currentPlayer, result["mainDeck"]);
        
        // Add draw phase event that requires acknowledgment
        this.addGameEvent(gameEnv, 'DRAW_PHASE_COMPLETE', {
            playerId: gameEnv["currentPlayer"],
            cardCount: 1,
            newHandSize: result["hand"].length,
            requiresAcknowledgment: true
        });
        
        // Add turn switch event
        this.addGameEvent(gameEnv, 'TURN_SWITCH', {
            newPlayer: gameEnv["currentPlayer"],
            turn: gameEnv["currentTurn"],
            phase: 'DRAW_PHASE'
        });
        
        return gameEnv;
    }
    /**
     * Calculates total player points including all effects and combos
     * This is the core scoring function that determines battle outcomes
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player whose points to calculate
     * @returns {number} Total points including base power, effects, and combos
     */
    async calculatePlayerPoint(gameEnv, playerId) {
        let totalPoints = 0;
        const fields = ['top', 'left', 'right'];
        const playerField = this.getPlayerField(gameEnv, playerId);
        const currentLeader = playerField.leader;
        
        // Load all card data for effect processing
        const characterCards = require('../data/characterCards.json');
        const utilityCards = require('../data/utilityCards.json');
        const leaderCards = require('../data/leaderCards.json');
        
        // Step 1: Calculate base power for each face-up character card with field effects
        let characterPowers = {};
        for (const zone of fields) {
            if (playerField[zone] && playerField[zone].length > 0) {
                for (const cardObj of playerField[zone]) {
                    // Only count face-up character cards for power calculation - FIXED for safety
                    // Handle both legacy and new card structures safely
                    let cardData = null;
                    let isFaceDown = false;
                    
                    if (cardObj.cardDetails && Array.isArray(cardObj.cardDetails) && cardObj.cardDetails.length > 0) {
                        cardData = cardObj.cardDetails[0];
                    } else if (cardObj.id) {
                        cardData = cardObj;
                    }
                    
                    if (cardObj.isBack && Array.isArray(cardObj.isBack) && cardObj.isBack.length > 0) {
                        isFaceDown = cardObj.isBack[0];
                    } else if (typeof cardObj.isBack === 'boolean') {
                        isFaceDown = cardObj.isBack;
                    }
                    
                    if (cardData && cardData.cardType === 'character' && !isFaceDown) {
                        const cardId = cardData.id;
                        const basePower = cardData.power || 0;
                        
                        // Check unified field effects system for power overrides
                        let modifiedPower = basePower;
                        let hasUnifiedSystemOverride = false;
                        
                        // Check if there's a calculated power override in the unified system
                        if (gameEnv.players && 
                            gameEnv.players[playerId] && 
                            gameEnv.players[playerId].fieldEffects && 
                            gameEnv.players[playerId].fieldEffects.calculatedPowers &&
                            gameEnv.players[playerId].fieldEffects.calculatedPowers[cardId] !== undefined) {
                            
                            modifiedPower = gameEnv.players[playerId].fieldEffects.calculatedPowers[cardId];
                            hasUnifiedSystemOverride = true;
                            console.log(`Using unified system power override for ${cardId}: ${modifiedPower}`);
                        }
                        
                        characterPowers[cardId] = { 
                            basePower: modifiedPower,  // Use field effect modified power as base
                            zone, 
                            modifiers: 0,
                            hasUnifiedSystemOverride  // Track if this card has unified system override
                        };
                    }
                }
            }
        }
        
        // Step 2: Apply leader continuous effects (always active)
        if (currentLeader && currentLeader.effects && currentLeader.effects.rules) {
            for (const rule of currentLeader.effects.rules) {
                if (rule.type === 'continuous') {
                    characterPowers = this.applyEffectRule(rule, characterPowers, playerField, gameEnv, playerId, 'leader', currentLeader);
                }
            }
        }
        
        // Step 2.5: Apply character card continuous effects (from character cards in field)
        for (const zone of fields) {
            if (playerField[zone] && playerField[zone].length > 0) {
                for (const cardObj of playerField[zone]) {
                    // Only apply effects from face-up character cards - FIXED for safety
                    // Handle both legacy and new card structures safely
                    let cardData = null;
                    let isFaceDown = false;
                    
                    if (cardObj.cardDetails && Array.isArray(cardObj.cardDetails) && cardObj.cardDetails.length > 0) {
                        cardData = cardObj.cardDetails[0];
                    } else if (cardObj.id) {
                        cardData = cardObj;
                    }
                    
                    if (cardObj.isBack && Array.isArray(cardObj.isBack) && cardObj.isBack.length > 0) {
                        isFaceDown = cardObj.isBack[0];
                    } else if (typeof cardObj.isBack === 'boolean') {
                        isFaceDown = cardObj.isBack;
                    }
                    
                    if (cardData && cardData.cardType === 'character' && !isFaceDown) {
                        const cardId = cardData.id;
                        const characterCard = characterCards.cards[cardId];
                        if (characterCard && characterCard.effects && characterCard.effects.rules) {
                            for (const rule of characterCard.effects.rules) {
                                if (rule.type === 'continuous') {
                                    characterPowers = this.applyEffectRule(rule, characterPowers, playerField, gameEnv, playerId, 'character', characterCard);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Step 3: Apply utility card continuous effects (help and SP cards)
        const utilityZones = ['help', 'sp'];
        for (const zone of utilityZones) {
            if (playerField && playerField[zone] && playerField[zone].length > 0) {
                for (const cardObj of playerField[zone]) {
                    // Only apply effects from face-up utility cards - FIXED for safety
                    // Handle both legacy and new card structures safely
                    let isFaceDown = false;
                    let cardId = null;
                    
                    if (cardObj.isBack && Array.isArray(cardObj.isBack) && cardObj.isBack.length > 0) {
                        isFaceDown = cardObj.isBack[0];
                    } else if (typeof cardObj.isBack === 'boolean') {
                        isFaceDown = cardObj.isBack;
                    }
                    
                    if (cardObj.cardDetails && Array.isArray(cardObj.cardDetails) && cardObj.cardDetails.length > 0) {
                        cardId = cardObj.cardDetails[0].id;
                    } else if (cardObj.id) {
                        cardId = cardObj.id;
                    } else if (typeof cardObj === 'string') {
                        cardId = cardObj;
                    }
                    
                    if (!isFaceDown && cardId) {
                        const utilityCard = utilityCards.cards[cardId];
                        if (utilityCard && utilityCard.effects && utilityCard.effects.rules) {
                            for (const rule of utilityCard.effects.rules) {
                                if (rule.type === 'continuous') {
                                    characterPowers = this.applyEffectRule(rule, characterPowers, playerField, gameEnv, playerId, 'utility', utilityCard);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Step 4: Calculate total power from all characters (enforce minimum 0)
        for (const cardId in characterPowers) {
            const finalPower = Math.max(0, characterPowers[cardId].basePower + characterPowers[cardId].modifiers);
            totalPoints += finalPower;
        }
        
        // Step 5: Add combo bonuses for special card combinations (if not disabled)
        let comboBonus = 0;
        if (!gameEnv.disabledEffects || !gameEnv.disabledEffects[playerId] || !gameEnv.disabledEffects[playerId].comboBonus) {
            comboBonus = this.calculateComboBonus(characterPowers, characterCards, gameEnv, playerId);
        }
        totalPoints += comboBonus;
        
        // Step 6: Apply final calculation effects (like totalPowerNerf)
        totalPoints = this.applyFinalCalculationEffects(gameEnv, playerId, totalPoints);
        
        return totalPoints;
    }
    
    /**
     * Apply final calculation effects that modify total power after combo calculation
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player whose power is being calculated
     * @param {number} totalPoints - Current total power before final effects
     * @returns {number} Final power after all effects
     */
    applyFinalCalculationEffects(gameEnv, playerId, totalPoints) {
        // Load utility cards for checking final calculation effects
        const utilityCards = require('../data/utilityCards.json');
        
        // Check all players' utility cards for final calculation effects
        const allPlayers = [playerId, this.getOpponentId(gameEnv, playerId)];
        
        for (const checkPlayerId of allPlayers) {
            const playerField = this.getPlayerField(gameEnv, checkPlayerId);
            const utilityZones = ['help', 'sp'];
            
            for (const zone of utilityZones) {
                if (playerField && playerField[zone] && playerField[zone].length > 0) {
                    for (const cardObj of playerField[zone]) {
                        // Only apply effects from face-up utility cards - FIXED for safety
                        // Handle both legacy and new card structures safely
                        let isFaceDown = false;
                        let cardId = null;
                        
                        if (cardObj.isBack && Array.isArray(cardObj.isBack) && cardObj.isBack.length > 0) {
                            isFaceDown = cardObj.isBack[0];
                        } else if (typeof cardObj.isBack === 'boolean') {
                            isFaceDown = cardObj.isBack;
                        }
                        
                        if (cardObj.cardDetails && Array.isArray(cardObj.cardDetails) && cardObj.cardDetails.length > 0) {
                            cardId = cardObj.cardDetails[0].id;
                        } else if (cardObj.id) {
                            cardId = cardObj.id;
                        } else if (typeof cardObj === 'string') {
                            cardId = cardObj;
                        }
                        
                        if (!isFaceDown && cardId) {
                            const utilityCard = utilityCards.cards[cardId];
                            
                            if (utilityCard && utilityCard.effects && utilityCard.effects.rules) {
                                for (const rule of utilityCard.effects.rules) {
                                    if (rule.type === 'triggered' && rule.trigger.event === 'finalCalculation') {
                                        // Check if conditions are met
                                        if (this.checkRuleConditions(rule.trigger.conditions, playerField, gameEnv, checkPlayerId)) {
                                            // Apply totalPowerNerf to target player
                                            if (rule.effect.type === 'totalPowerNerf') {
                                                const targetPlayerId = rule.target.owner === 'opponent' ? 
                                                    this.getOpponentId(gameEnv, checkPlayerId) : checkPlayerId;
                                                
                                                if (targetPlayerId === playerId) {
                                                    totalPoints = Math.max(0, totalPoints - rule.effect.value);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return totalPoints;
    }

    async checkIsPlayOkForAction(gameEnv,playerId,action){
        var returnValue = false;
        
        // Get card details to check card type
        // Handle both unified and legacy formats
        const hand = this.getPlayerHand(gameEnv, playerId);
        console.log("hand", JSON.stringify(hand));
        if (!hand || action["card_idx"] >= hand.length) {
            return false;
        }
        
        const cardToPlay = hand[action["card_idx"]];
        const cardDetails = mozDeckHelper.getDeckCardDetails(cardToPlay);
        if (!cardDetails) {
            return false;
        }
        
        // Check for play restrictions from utility card effects
        if (gameEnv.playRestrictions && gameEnv.playRestrictions[playerId]) {
            const restrictions = gameEnv.playRestrictions[playerId];
            
            // Check if card type is restricted
            if (cardDetails["cardType"] === "help" && restrictions.help) {
                return false;
            }
            if (cardDetails["cardType"] === "sp" && restrictions.sp) {
                return false;
            }
        }
        
        // Check phase-based card placement rules
        if (gameEnv["currentPlayer"] == playerId) {
            if (gameEnv["phase"] == TurnPhase.MAIN_PHASE) {
                // During MAIN_PHASE: only character and help cards allowed
                if (cardDetails["cardType"] == "character") {
                    returnValue = true;
                } else if (cardDetails["cardType"] == "help") {
                    // Allow help card placement only if Help zone is empty
                    if (!this.shouldSkipHelpPhase(gameEnv, playerId)) {
                        returnValue = true;
                    }
                }
            } else if (gameEnv["phase"] == TurnPhase.SP_PHASE) {
                // During SP_PHASE: only SP cards allowed, and only if SP zone is empty
                if (cardDetails["cardType"] == "sp" && !this.shouldSkipSpPhase(gameEnv, playerId)) {
                    returnValue = true;
                }
            }
        }
        
        return returnValue;
    }

    
    isCardMatchingLeader(card, leader, area, gameEnv = null, playerId = null){
        // Check if player has zone placement freedom (now in fieldEffects)
        if (gameEnv && playerId && gameEnv.players && gameEnv.players[playerId] &&
            gameEnv.players[playerId].fieldEffects && gameEnv.players[playerId].fieldEffects.specialEffects &&
            gameEnv.players[playerId].fieldEffects.specialEffects.zonePlacementFreedom) {
            return true;
        }
        
        var returnValue = false;
        for (let idx in card["traits"]){
            if(card["traits"][idx] == "all"){
                returnValue = true;
                return returnValue;
            }
        }
        if(area == "help" || area == "sp"){
            return true;
        }
        const allowedTypes = leader.zoneCompatibility && leader.zoneCompatibility[area] ? leader.zoneCompatibility[area] : [];
        allowedTypes.forEach(function(attr){
            if(attr == "all"){
                returnValue = true;
                return returnValue;
            }
            var isAttrMatch = false;
            for (let key in card["traits"]){
                if(card["traits"][key] == attr){
                    isAttrMatch = true;
                }
            }
            if (isAttrMatch){
                returnValue = true;
            }
        });
        return returnValue
    }

    throwError(errorText){
        var returnObj = {}
        returnObj = {
            "error": errorText
        }
        return returnObj
    }

    applyEffectRule(rule, characterPowers, playerField, gameEnv, playerId, sourceType, sourceCard) {
        // Check if rule conditions are met
        if (!this.checkRuleConditions(rule.trigger.conditions, playerField, gameEnv, playerId)) {
            return characterPowers;
        }
        
        // Check if this effect should be neutralized by other cards
        if (this.isEffectNeutralized(rule, gameEnv, playerId, sourceCard)) {
            return characterPowers;
        }
        
        // Apply effect based on target
        const targets = this.getEffectTargets(rule.target, playerField, gameEnv, playerId);
        
        for (const target of targets) {
            if (rule.effect.type === 'modifyPower') {
                const cardId = target.cardId;
                if (characterPowers[cardId] && !characterPowers[cardId].hasUnifiedSystemOverride) {
                    if (rule.effect.operation === 'add') {
                        characterPowers[cardId].modifiers += rule.effect.value;
                    } else if (rule.effect.operation === 'set') {
                        characterPowers[cardId].modifiers = rule.effect.value - characterPowers[cardId].basePower;
                    }
                }
            } else if (rule.effect.type === 'powerBoost') {
                const cardId = target.cardId;
                if (characterPowers[cardId] && !characterPowers[cardId].hasUnifiedSystemOverride) {
                    characterPowers[cardId].modifiers += rule.effect.value;
                }
            } else if (rule.effect.type === 'setPower') {
                const cardId = target.cardId;
                if (characterPowers[cardId] && !characterPowers[cardId].hasUnifiedSystemOverride) {
                    characterPowers[cardId].modifiers = rule.effect.value - characterPowers[cardId].basePower;
                }
            } else if (rule.effect.type === 'neutralizeEffect') {
                // Handle effect neutralization - store in game state for later checking
                this.applyEffectNeutralization(rule, gameEnv, playerId);
            } else if (rule.effect.type === 'disableComboBonus') {
                // Store combo disable state in game environment
                const targetPlayerId = rule.target.owner === 'opponent' ? this.getOpponentId(gameEnv, playerId) : playerId;
                if (!gameEnv.disabledEffects) gameEnv.disabledEffects = {};
                if (!gameEnv.disabledEffects[targetPlayerId]) gameEnv.disabledEffects[targetPlayerId] = {};
                gameEnv.disabledEffects[targetPlayerId].comboBonus = true;
            } else if (rule.effect.type === 'silenceOnSummon') {
                // Store silence state in game environment
                const targetPlayerId = rule.target.owner === 'opponent' ? this.getOpponentId(gameEnv, playerId) : playerId;
                if (!gameEnv.disabledEffects) gameEnv.disabledEffects = {};
                if (!gameEnv.disabledEffects[targetPlayerId]) gameEnv.disabledEffects[targetPlayerId] = {};
                gameEnv.disabledEffects[targetPlayerId].summonEffects = true;
            } else if (rule.effect.type === 'zonePlacementFreedom') {
                // Store zone freedom state in fieldEffects (unified structure)
                const targetPlayerId = rule.target.owner === 'opponent' ? this.getOpponentId(gameEnv, playerId) : playerId;
                if (!gameEnv.players[targetPlayerId].fieldEffects.specialEffects) {
                    gameEnv.players[targetPlayerId].fieldEffects.specialEffects = {};
                }
                gameEnv.players[targetPlayerId].fieldEffects.specialEffects.zonePlacementFreedom = true;
            }
        }
        
        return characterPowers;
    }
    
    /**
     * Check if an effect should be neutralized by other cards
     * @param {Object} rule - The effect rule to check
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID whose effect is being checked
     * @returns {boolean} True if effect should be neutralized
     */
    isEffectNeutralized(rule, gameEnv, playerId, sourceCard) {
        // Check if this card has immunity to neutralization
        // Immunity is defined at the card level in effects.immuneToNeutralization
        if (sourceCard && sourceCard.effects && sourceCard.effects.immuneToNeutralization) {
            return false;
        }
        
        // Check if there are any neutralization effects targeting this player
        if (gameEnv.neutralizedEffects && gameEnv.neutralizedEffects[playerId]) {
            const neutralizations = gameEnv.neutralizedEffects[playerId];
            
            // Check for specific card neutralization (new targeted system)
            if (neutralizations.specificCards && sourceCard) {
                const isSpecificallyNeutralized = neutralizations.specificCards.some(neutralizedCard => 
                    neutralizedCard.cardId === sourceCard.id
                );
                if (isSpecificallyNeutralized) {
                    return true;
                }
            }
            
            // Check for all effect neutralization (legacy system)
            if (neutralizations.allEffects) {
                return true;
            }
            
            // Check for specific zone neutralization (legacy system)
            if (neutralizations.zones && neutralizations.zones.includes(rule.target.zones)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Apply effect neutralization to target player
     * @param {Object} rule - The neutralization rule
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID applying the neutralization
     */
    applyEffectNeutralization(rule, gameEnv, playerId) {
        const targetPlayerId = rule.target.owner === 'opponent' ? this.getOpponentId(gameEnv, playerId) : playerId;
        
        if (!gameEnv.neutralizedEffects) gameEnv.neutralizedEffects = {};
        if (!gameEnv.neutralizedEffects[targetPlayerId]) gameEnv.neutralizedEffects[targetPlayerId] = {};
        
        // Neutralize all effects in target zones
        if (rule.target.zones.includes('help') || rule.target.zones.includes('sp')) {
            gameEnv.neutralizedEffects[targetPlayerId].allEffects = true;
        }
        
        // Store specific zone neutralization
        if (!gameEnv.neutralizedEffects[targetPlayerId].zones) {
            gameEnv.neutralizedEffects[targetPlayerId].zones = [];
        }
        gameEnv.neutralizedEffects[targetPlayerId].zones.push(...rule.target.zones);
    }
    
    checkRuleConditions(conditions, playerField, gameEnv, playerId) {
        if (!conditions || conditions.length === 0) return true;
        
        for (const condition of conditions) {
            if (condition.type === 'selfHasCharacterWithName') {
                const hasCharacter = this.hasCharacterWithName(playerField, condition.value);
                if (!hasCharacter) return false;
            } else if (condition.type === 'selfHasLeader') {
                const hasLeader = playerField.leader && playerField.leader.name && playerField.leader.name.includes(condition.value);
                if (!hasLeader) return false;
            } else if (condition.type === 'opponentHandCardCountMoreThan') {
                const opponentId = this.getOpponentId(gameEnv, playerId);
                const opponentHandCount = this.getPlayerHand(gameEnv, opponentId).length;
                if (opponentHandCount <= condition.value) return false;
            } else if (condition.type === 'zoneEmpty') {
                const zone = condition.zone;
                if (playerField[zone] && playerField[zone].length > 0) return false;
            } else if (condition.type === 'opponentHasCharacterWithName') {
                const opponentId = this.getOpponentId(gameEnv, playerId);
                const hasCharacter = this.hasCharacterWithName(this.getPlayerField(gameEnv, opponentId), condition.value);
                if (!hasCharacter) return false;
            } else if (condition.type === 'opponentHasLeader') {
                const opponentId = this.getOpponentId(gameEnv, playerId);
                const opponentField = this.getPlayerField(gameEnv, opponentId);
                const hasLeader = opponentField.leader && opponentField.leader.name && opponentField.leader.name.includes(condition.value);
                if (!hasLeader) return false;
            } else if (condition.type === 'or') {
                // Handle OR conditions
                let orConditionMet = false;
                for (const orCondition of condition.conditions) {
                    if (this.checkRuleConditions([orCondition], playerField, gameEnv, playerId)) {
                        orConditionMet = true;
                        break;
                    }
                }
                if (!orConditionMet) return false;
            } else if (condition.type === 'allyFieldContainsName') {
                // Check if ally field contains card with specific name
                const hasCharacter = this.hasCharacterWithName(playerField, condition.value);
                const hasLeader = playerField.leader && playerField.leader.name && playerField.leader.name.includes(condition.value);
                if (!hasCharacter && !hasLeader) return false;
            } else if (condition.type === 'opponentFieldContainsName') {
                // Check if opponent field contains card with specific name
                const opponentId = this.getOpponentId(gameEnv, playerId);
                const opponentField = this.getPlayerField(gameEnv, opponentId);
                const hasCharacter = this.hasCharacterWithName(opponentField, condition.value);
                const hasLeader = opponentField.leader && opponentField.leader.name && opponentField.leader.name.includes(condition.value);
                if (!hasCharacter && !hasLeader) return false;
            } else if (condition.type === 'opponentHandCount') {
                // Check opponent hand count with operator
                const opponentId = this.getOpponentId(gameEnv, playerId);
                const opponentHandCount = this.getPlayerHand(gameEnv, opponentId).length;
                if (condition.operator === '>=') {
                    if (opponentHandCount < condition.value) return false;
                } else if (condition.operator === '<=') {
                    if (opponentHandCount > condition.value) return false;
                } else if (condition.operator === '=') {
                    if (opponentHandCount !== condition.value) return false;
                }
            } else if (condition.type === 'opponentLeader') {
                // Check if opponent has specific leader
                const opponentId = this.getOpponentId(gameEnv, playerId);
                const opponentField = this.getPlayerField(gameEnv, opponentId);
                const hasLeader = opponentField.leader && opponentField.leader.name && opponentField.leader.name.includes(condition.value);
                if (!hasLeader) return false;
            }
        }
        
        return true;
    }
    
    hasCharacterWithName(playerField, name) {
        const fields = ['top', 'left', 'right'];
        for (const zone of fields) {
            if (playerField[zone] && playerField[zone].length > 0) {
                for (const cardObj of playerField[zone]) {
                    // Handle both legacy and new card structures safely
                    let cardName = null;
                    if (cardObj.cardDetails && Array.isArray(cardObj.cardDetails) && cardObj.cardDetails.length > 0) {
                        cardName = cardObj.cardDetails[0].name;
                    } else if (cardObj.name) {
                        cardName = cardObj.name;
                    }
                    
                    if (cardName && cardName.includes(name)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    getEffectTargets(target, playerField, gameEnv, playerId) {
        const targets = [];
        const fields = target.zones || ['top', 'left', 'right'];
        
        // Determine which player's field to check
        let targetField;
        if (target.owner === 'self') {
            targetField = playerField;
        } else if (target.owner === 'opponent') {
            const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
            const opponentId = playerList.find(p => p !== playerId);
            targetField = this.getPlayerField(gameEnv, opponentId);
        }
        
        if (!targetField) return targets;
        
        for (const zone of fields) {
            if (targetField[zone] && targetField[zone].length > 0) {
                for (const cardObj of targetField[zone]) {
                    if (this.matchesFilters(cardObj, target.filters)) {
                        // Handle both legacy and new card structures safely
                        let cardData = null;
                        if (cardObj.cardDetails && Array.isArray(cardObj.cardDetails) && cardObj.cardDetails.length > 0) {
                            cardData = cardObj.cardDetails[0];
                        } else if (cardObj.id) {
                            cardData = cardObj;
                        }
                        
                        targets.push({ 
                            cardId: cardData ? cardData.id : null, 
                            zone, 
                            cardObj,
                            name: cardData ? cardData.name : null,
                            cardType: cardData ? cardData.cardType : null
                        });
                        if (target.limit && targets.length >= target.limit) {
                            return targets;
                        }
                    }
                }
            }
        }
        
        // Handle targetCount selection logic
        if (target.targetCount && targets.length > target.targetCount) {
            // Automatically select the first N targets (no player selection needed)
            return targets.slice(0, target.targetCount);
        }
        
        return targets;
    }
    
    /**
     * Safely extract card data from both old and new card formats
     */
    getCardData(cardObj) {
        // Handle new format (direct card object)
        if (cardObj.id && cardObj.cardType) {
            return cardObj;
        }
        
        // Handle old format (cardDetails array)
        if (cardObj.cardDetails && Array.isArray(cardObj.cardDetails) && cardObj.cardDetails.length > 0) {
            return cardObj.cardDetails[0];
        }
        
        console.warn('Unable to extract card data from:', cardObj);
        return null;
    }

    matchesFilters(cardObj, filters) {
        if (!filters || filters.length === 0) return true;
        
        const cardData = this.getCardData(cardObj);
        if (!cardData) return false;
        
        for (const filter of filters) {
            if (filter.type === 'hasTrait') {
                const traits = cardData.traits || [];
                if (!traits.includes(filter.value)) return false;
            } else if (filter.type === 'hasGameType') {
                const gameType = cardData.gameType;
                if (Array.isArray(filter.value)) {
                    if (!filter.value.includes(gameType)) return false;
                } else {
                    if (gameType !== filter.value) return false;
                }
            }
        }
        
        return true;
    }
    
    calculateComboBonus(characterPowers, characterCards, gameEnv, playerId) {
        let comboBonus = 0;
        const combos = characterCards.combos || {};
        
        // Get all face-up character cards
        const activeCards = [];
        for (const cardId in characterPowers) {
            const cardData = characterCards.cards[cardId];
            if (cardData) {
                activeCards.push(cardData);
            }
        }
        
        if (activeCards.length === 0) return 0;
        
        // Check for combo types
        if (combos.all_same_type && this.checkAllSameType(activeCards)) {
            comboBonus += combos.all_same_type.bonus;
        }
        
        if (combos.all_different_type && this.checkAllDifferentType(activeCards)) {
            comboBonus += combos.all_different_type.bonus;
        }
        
        if (combos.high_power_trio && this.checkHighPowerTrio(activeCards)) {
            comboBonus += combos.high_power_trio.bonus;
        }
        
        if (combos.trait_synergy && this.checkTraitSynergy(activeCards)) {
            comboBonus += combos.trait_synergy.bonus;
        }
        
        if (combos.balanced_power && this.checkBalancedPower(activeCards)) {
            comboBonus += combos.balanced_power.bonus;
        }
        
        return comboBonus;
    }
    
    checkAllSameType(cards) {
        if (cards.length < 2) return false;
        const firstType = cards[0].gameType;
        return cards.every(card => card.gameType === firstType);
    }
    
    checkAllDifferentType(cards) {
        if (cards.length < 2) return false;
        const types = new Set(cards.map(card => card.gameType));
        return types.size === cards.length;
    }
    
    checkHighPowerTrio(cards) {
        if (cards.length < 3) return false;
        return cards.every(card => card.power >= 80);
    }
    
    checkTraitSynergy(cards) {
        if (cards.length < 2) return false;
        const allTraits = cards.flatMap(card => card.traits || []);
        const traitCounts = {};
        for (const trait of allTraits) {
            traitCounts[trait] = (traitCounts[trait] || 0) + 1;
        }
        return Object.values(traitCounts).some(count => count >= 2);
    }
    
    checkBalancedPower(cards) {
        if (cards.length < 3) return false;
        const powers = cards.map(card => card.power).sort((a, b) => a - b);
        const diff = powers[powers.length - 1] - powers[0];
        return diff <= 30;
    }
    
    /**
     * Processes character card summon effects
     * Executes triggered effects that occur when a character is summoned to the field
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player who summoned the character
     * @param {Object} cardDetails - Details of the summoned character card
     */
    async processCharacterSummonEffects(gameEnv, playerId, cardDetails) {
        if (!cardDetails.effects || !cardDetails.effects.rules) return;
        
        // Check if summon effects are silenced
        if (gameEnv.disabledEffects && gameEnv.disabledEffects[playerId] && 
            gameEnv.disabledEffects[playerId].summonEffects) {
            return;
        }
        
        const characterCards = require('../data/characterCards.json');
        const cardData = characterCards.cards[cardDetails.id];
        
        if (cardData && cardData.effects && cardData.effects.rules) {
            for (const rule of cardData.effects.rules) {
                // Execute onSummon triggered effects (e.g., draw cards, search deck)
                if (rule.type === 'triggered' && rule.trigger.event === 'onSummon') {
                    const effectResult = await this.executeEffectRule(rule, gameEnv, playerId);
                    if (effectResult && effectResult.requiresCardSelection) {
                        return effectResult;
                    }
                }
            }
        }
    }
    
    /**
     * Processes utility card (help/SP) play effects
     * Executes triggered effects that occur when utility cards are played
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player who played the utility card
     * @param {Object} cardDetails - Details of the played utility card
     */
    async processUtilityCardEffects(gameEnv, playerId, cardDetails) {
        if (!cardDetails.effects || !cardDetails.effects.rules) return;
        
        const utilityCards = require('../data/utilityCards.json');
        const cardData = utilityCards.cards[cardDetails.id];
        
        if (cardData && cardData.effects && cardData.effects.rules) {
            for (const rule of cardData.effects.rules) {
                // Execute onPlay triggered effects (e.g., discard cards, force actions)
                if (rule.type === 'triggered' && rule.trigger.event === 'onPlay') {
                    const effectResult = await this.executeEffectRule(rule, gameEnv, playerId);
                    if (effectResult && effectResult.requiresCardSelection) {
                        return effectResult;
                    }
                }
                // Note: Continuous effects are processed during calculatePlayerPoint
            }
        }
    }
    
    /**
     * Executes a specific effect rule
     * Handles various types of card effects like drawing cards, discarding, searching deck
     * @param {Object} rule - Effect rule from card data
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player who triggered the effect
     */
    async executeEffectRule(rule, gameEnv, playerId) {
        // Check if effect conditions are met before executing
        if (!this.checkRuleConditions(rule.trigger.conditions, this.getPlayerField(gameEnv, playerId), gameEnv, playerId)) {
            return {
                success: false,
                reason: 'Effect conditions not met'
            };
        }
        
        // Determine target player (self or opponent)
        const targetPlayerId = rule.target.owner === 'opponent' ? this.getOpponentId(gameEnv, playerId) : playerId;
        
        // Execute different types of triggered effects
        if (rule.effect.type === 'drawCards' || rule.effect.type === 'drawCard') {
            // Force target to draw cards from deck (support both naming conventions)
            await this.drawCardsForPlayer(gameEnv, targetPlayerId, rule.effect.value);
            return {
                success: true,
                effectType: 'drawCards',
                executed: true
            };
        } else if (rule.effect.type === 'discardRandomCard') {
            // Force target to randomly discard cards from hand
            await this.discardRandomCards(gameEnv, targetPlayerId, rule.effect.value);
            return {
                success: true,
                effectType: 'discardRandomCard',
                executed: true
            };
        } else if (rule.effect.type === 'searchCard') {
            // Search deck for specific cards and add to hand
            const searchResult = await this.searchCardEffect(gameEnv, targetPlayerId, rule.effect);
            if (searchResult) {
                // Return indication that user selection is required with gameEnv
                return {
                    requiresCardSelection: true,
                    gameEnv
                };
            } else {
                // Search completed without user selection needed
                return {
                    success: true,
                    effectType: 'searchCard',
                    executed: true
                };
            }
        } else if (rule.effect.type === 'forcePlaySP' || rule.effect.type === 'forceSPPlay') {
            // Force opponent to play SP card in next SP phase
            gameEnv[targetPlayerId]['forcedSpPlay'] = true;
            return {
                success: true,
                effectType: 'forceSPPlay',
                executed: true
            };
        } else if (rule.effect.type === 'randomDiscard') {
            // Force target to randomly discard cards from hand
            await this.discardRandomCards(gameEnv, targetPlayerId, rule.effect.value);
            return {
                success: true,
                effectType: 'randomDiscard',
                executed: true
            };
        } else if (rule.effect.type === 'preventPlay') {
            // Prevent opponent from playing cards in specific zones
            if (!gameEnv.playRestrictions) gameEnv.playRestrictions = {};
            if (!gameEnv.playRestrictions[targetPlayerId]) gameEnv.playRestrictions[targetPlayerId] = {};
            
            for (const zone of rule.target.zones) {
                gameEnv.playRestrictions[targetPlayerId][zone] = true;
            }
            
            return {
                success: true,
                effectType: 'preventPlay',
                executed: true
            };
        } else if (rule.effect.type === 'neutralizeEffect' && rule.target.requiresSelection) {
            // Neutralize specific card effects based on player selection
            return await this.neutralizeEffectSelection(gameEnv, rule, playerId);
        } else if (rule.effect.type === 'setPower' && rule.target.requiresSelection) {
            // Set specific card power based on player selection
            return await this.setPowerSelection(gameEnv, rule, playerId);
        }
        
        // Unknown effect type
        return {
            success: false,
            reason: `Unknown effect type: ${rule.effect.type}`
        };
        // Note: Continuous effects (modifyPower, invalidateEffect, etc.) are handled in calculatePlayerPoint
    }
    
    /**
     * Force a player to randomly discard cards from their hand
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player to discard cards
     * @param {number} count - Number of cards to discard
     */
    async discardRandomCards(gameEnv, playerId, count) {
        const hand = this.getPlayerHand(gameEnv, playerId);
        const actualCount = Math.min(count, hand.length);
        
        for (let i = 0; i < actualCount; i++) {
            const randomIndex = Math.floor(Math.random() * hand.length);
            const discardedCard = hand.splice(randomIndex, 1)[0];
            
            // Add event for card discarded
            this.addEvent(gameEnv, 'CARD_DISCARDED', {
                playerId: playerId,
                cardId: discardedCard,
                reason: 'randomDiscard'
            });
        }
    }
    
    /**
     * Check if the game is currently waiting for a specific player action
     * @param {Object} gameEnv - Current game environment
     * @returns {Object|null} Pending action info or null if no pending action
     */
    getPendingPlayerAction(gameEnv) {
        return gameEnv.pendingPlayerAction || null;
    }
    
    /**
     * Check if a specific player can take actions right now
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @returns {Object} Result with canAct boolean and reason if blocked
     */
    canPlayerAct(gameEnv, playerId) {
        const pendingAction = this.getPendingPlayerAction(gameEnv);
        
        if (!pendingAction) {
            return { canAct: true };
        }
        
        if (pendingAction.type === 'cardSelection') {
            if (pendingAction.playerId === playerId) {
                return {
                    canAct: false,
                    reason: `Must complete card selection first: ${pendingAction.description}`,
                    requiredAction: 'selectCard'
                };
            } else {
                return {
                    canAct: false,
                    reason: `Waiting for ${pendingAction.playerId} to complete card selection`,
                    waitingFor: pendingAction.playerId
                };
            }
        }
        
        return {
            canAct: false,
            reason: `Unknown pending action: ${pendingAction.type}`
        };
    }
    
    /**
     * Gets the opponent's player ID
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Current player's ID
     * @returns {string} Opponent's player ID
     */
    getOpponentId(gameEnv, playerId) {
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        return playerList.find(p => p !== playerId);
    }
    
    /**
     * Executes search card effect - allows player to search deck for specific cards
     * Used by cards like "海湖莊園" to search for character cards
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player performing the search
     * @param {Object} effect - Search effect parameters (searchCount, selectCount, cardTypeFilter)
     */
    async searchCardEffect(gameEnv, playerId, effect) {
        const deck = this.getPlayerMainDeck(gameEnv, playerId);
        const hand = this.getPlayerHand(gameEnv, playerId);
        
        if (deck.length === 0) return null;
        
        // Look at top N cards from deck
        const searchCount = Math.min(effect.searchCount, deck.length);
        const topCards = deck.slice(0, searchCount);
        
        // Filter cards by filters if specified (e.g., only character cards, SP cards, etc.)
        let eligibleCards = topCards;
        if (effect.filters && effect.filters.length > 0) {
            const characterCards = require('../data/characterCards.json');
            const utilityCards = require('../data/utilityCards.json');
            
            eligibleCards = topCards.filter(cardId => {
                const charCard = characterCards.cards[cardId];
                const utilCard = utilityCards.cards[cardId];
                const card = charCard || utilCard;
                
                if (!card) return false;
                
                // Check all filters
                return effect.filters.every(filter => {
                    if (filter.type === 'cardType') {
                        return card.cardType === filter.value;
                    }
                    // Add more filter types as needed
                    return true;
                });
            });
        } else if (effect.cardTypeFilter) {
            // Support legacy cardTypeFilter for backward compatibility
            const characterCards = require('../data/characterCards.json');
            const utilityCards = require('../data/utilityCards.json');
            
            eligibleCards = topCards.filter(cardId => {
                const charCard = characterCards.cards[cardId];
                const utilCard = utilityCards.cards[cardId];
                const card = charCard || utilCard;
                return card && card.cardType === effect.cardTypeFilter;
            });
        }
        
        // Return card selection data for frontend instead of auto-selecting
        const selectCount = Math.min(effect.selectCount, eligibleCards.length);
        
        if (eligibleCards.length === 0) {
            // No eligible cards found, put searched cards back to bottom
            for (const cardId of topCards) {
                const deckIndex = deck.indexOf(cardId);
                if (deckIndex !== -1) {
                    deck.splice(deckIndex, 1);
                    deck.push(cardId);
                }
            }
            return null;
        }
        
        // Store card selection state (single source of truth)
        if (!gameEnv.pendingCardSelections) {
            gameEnv.pendingCardSelections = {};
        }
        
        const selectionId = `${playerId}_${Date.now()}`;
        gameEnv.pendingCardSelections[selectionId] = {
            playerId,
            eligibleCards,
            searchedCards: topCards,
            selectCount,
            effect,
            cardTypeFilter: effect.cardTypeFilter || null,
            timestamp: Date.now()
        };
        
        // Set simple pending action indicator
        gameEnv.pendingPlayerAction = {
            type: 'cardSelection',
            selectionId: selectionId
        };
        
        // Return selection prompt data
        return {
            selectionId,
            eligibleCards,
            selectCount,
            cardTypeFilter: effect.cardTypeFilter || null,
            prompt: `Select ${selectCount} card(s) from ${eligibleCards.length} available cards`
        };
    }
    
    /**
     * Handle neutralization effect that requires player selection
     * Used by cards like h-1 (Deep State) to select specific opponent cards to neutralize
     * @param {Object} gameEnv - Current game environment
     * @param {Object} rule - Effect rule from card data
     * @param {string} playerId - Player who triggered the effect
     */
    async neutralizeEffectSelection(gameEnv, rule, playerId) {
        const targetPlayerId = rule.target.owner === 'opponent' ? this.getOpponentId(gameEnv, playerId) : playerId;
        
        // Find all cards in opponent's specified zones
        const eligibleCards = [];
        for (const zone of rule.target.zones) {
            const zoneCards = this.getPlayerZone(gameEnv, targetPlayerId, zone);
            if (zoneCards && zoneCards.length > 0) {
                for (const cardObj of zoneCards) {
                    // Cards in zones are stored as { card: [id], cardDetails: [data], isBack: [bool] }
                    // Add some safety checks for the card structure
                    if (!cardObj.card || !Array.isArray(cardObj.card) || cardObj.card.length === 0) {
                        console.warn(`Invalid card structure in ${zone} zone:`, cardObj);
                        continue;
                    }
                    
                    const cardId = cardObj.card[0];
                    const cardData = cardObj.cardDetails && cardObj.cardDetails[0];
                    
                    // Only include cards that have effects to neutralize AND are not immune
                    if (cardData && cardData.effects && cardData.effects.rules && cardData.effects.rules.length > 0) {
                        // Check if card is immune to neutralization
                        if (cardData.effects.immuneToNeutralization) {
                            console.log(`Card ${cardData.name} (${cardId}) is immune to neutralization - excluding from targets`);
                            continue;
                        }
                        
                        eligibleCards.push({
                            cardId: cardId,
                            zone: zone,
                            name: cardData.name,
                            cardType: cardData.cardType
                        });
                    }
                }
            }
        }
        
        if (eligibleCards.length === 0) {
            return {
                success: false,
                reason: 'No eligible cards to neutralize'
            };
        }
        
        
        // Create card selection state
        if (!gameEnv.pendingCardSelections) {
            gameEnv.pendingCardSelections = {};
        }
        
        const selectionId = `${playerId}_neutralize_${Date.now()}`;
        gameEnv.pendingCardSelections[selectionId] = {
            playerId,
            eligibleCards,
            selectCount: rule.target.selectCount || 1,
            effect: rule.effect,
            effectType: 'neutralizeEffect',
            targetPlayerId,
            timestamp: Date.now()
        };
        
        // Set pending action indicator
        gameEnv.pendingPlayerAction = {
            type: 'cardSelection',
            selectionId: selectionId,
            description: `Select ${rule.target.selectCount || 1} opponent card(s) to neutralize`
        };
        
        // Add game event for card selection requirement
        this.addGameEvent(gameEnv, 'CARD_SELECTION_REQUIRED', {
            playerId: playerId,
            selectionId: selectionId,
            eligibleCardCount: eligibleCards.length,
            selectCount: rule.target.selectCount || 1,
            effectType: 'neutralizeEffect'
        });
        
        // Return selection prompt data in the format expected by the calling code
        return {
            requiresCardSelection: true,
            gameEnv,
            cardSelection: {
                selectionId,
                eligibleCards,
                selectCount: rule.target.selectCount || 1,
                effectType: 'neutralizeEffect',
                cardTypeFilter: 'help,sp'
            },
            prompt: `Select ${rule.target.selectCount || 1} opponent card(s) to neutralize`
        };
    }
    
    /**
     * Handle set power effect that requires player selection
     * Used by cards like h-2 (Make America Great Again) to select specific opponent cards to set power to 0
     * @param {Object} gameEnv - Current game environment
     * @param {Object} rule - Effect rule from card data
     * @param {string} playerId - Player who triggered the effect
     */
    async setPowerSelection(gameEnv, rule, playerId) {
        const targetPlayerId = rule.target.owner === 'opponent' ? this.getOpponentId(gameEnv, playerId) : playerId;
        
        // Find all cards in opponent's specified zones
        const eligibleCards = [];
        for (const zone of rule.target.zones) {
            const zoneCards = this.getPlayerZone(gameEnv, targetPlayerId, zone);
            if (zoneCards && zoneCards.length > 0) {
                for (const cardObj of zoneCards) {
                    // Extract card data using helper function (handles both formats)
                    const cardData = this.getCardData(cardObj);
                    if (!cardData) {
                        console.warn(`Unable to extract card data in ${zone} zone:`, cardObj);
                        continue;
                    }
                    
                    // Extract card ID (handle both formats)
                    let cardId;
                    if (cardObj.card && Array.isArray(cardObj.card) && cardObj.card.length > 0) {
                        cardId = cardObj.card[0]; // Old format
                    } else if (cardObj.id) {
                        cardId = cardObj.id; // New format
                    } else {
                        console.warn(`Unable to extract card ID in ${zone} zone:`, cardObj);
                        continue;
                    }
                    
                    // Check if card is face down (handle both formats)
                    let isFaceDown = false;
                    if (cardObj.isBack && Array.isArray(cardObj.isBack) && cardObj.isBack.length > 0) {
                        isFaceDown = cardObj.isBack[0]; // Old format
                    } else if (typeof cardObj.isBack === 'boolean') {
                        isFaceDown = cardObj.isBack; // New format
                    }
                    
                    // Only include face-up character cards (can't modify face-down cards)
                    if (cardData.cardType === 'character' && !isFaceDown) {
                        eligibleCards.push({
                            cardId: cardId,
                            zone: zone,
                            name: cardData.name,
                            cardType: cardData.cardType,
                            power: cardData.power
                        });
                    }
                }
            }
        }
        
        if (eligibleCards.length === 0) {
            return {
                success: false,
                reason: 'No eligible character cards to modify'
            };
        }
        
        // Create card selection state
        if (!gameEnv.pendingCardSelections) {
            gameEnv.pendingCardSelections = {};
        }
        
        const selectionId = `${playerId}_setPower_${Date.now()}`;
        gameEnv.pendingCardSelections[selectionId] = {
            playerId,
            eligibleCards,
            selectCount: rule.target.selectCount || 1,
            effect: rule.effect,
            effectType: 'setPower',
            targetPlayerId,
            timestamp: Date.now()
        };
        
        // Set pending action indicator
        gameEnv.pendingPlayerAction = {
            type: 'cardSelection',
            selectionId: selectionId,
            description: `Select ${rule.target.selectCount || 1} opponent character card(s) to set power to ${rule.effect.value}`
        };
        
        // Add game event for card selection requirement
        this.addGameEvent(gameEnv, 'CARD_SELECTION_REQUIRED', {
            playerId: playerId,
            selectionId: selectionId,
            eligibleCardCount: eligibleCards.length,
            selectCount: rule.target.selectCount || 1,
            effectType: 'setPower'
        });
        
        // Return selection prompt data in the format expected by the calling code
        return {
            requiresCardSelection: true,
            gameEnv,
            cardSelection: {
                selectionId,
                eligibleCards,
                selectCount: rule.target.selectCount || 1,
                effectType: 'setPower',
                cardTypeFilter: 'character'
            },
            prompt: `Select ${rule.target.selectCount || 1} opponent character card(s) to set power to ${rule.effect.value}`
        };
    }
    
    /**
     * Apply neutralization to selected cards
     * @param {Object} gameEnv - Current game environment
     * @param {string} selectionId - ID of the pending selection
     * @param {Array} selectedCardIds - Array of selected card IDs to neutralize
     */
    async applyNeutralizationSelection(gameEnv, selectionId, selectedCardIds) {
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, targetPlayerId } = selection;
        
        // Initialize neutralization state
        if (!gameEnv.neutralizedEffects) gameEnv.neutralizedEffects = {};
        if (!gameEnv.neutralizedEffects[targetPlayerId]) gameEnv.neutralizedEffects[targetPlayerId] = {};
        if (!gameEnv.neutralizedEffects[targetPlayerId].specificCards) {
            gameEnv.neutralizedEffects[targetPlayerId].specificCards = [];
        }
        
        // Add selected cards to neutralization list
        for (const cardId of selectedCardIds) {
            // Find the card in eligible cards to get full details
            const cardInfo = selection.eligibleCards.find(card => 
                (typeof card === 'string' && card === cardId) || 
                (typeof card === 'object' && card.cardId === cardId)
            );
            
            if (cardInfo) {
                const cardToNeutralize = typeof cardInfo === 'string' ? 
                    { cardId: cardInfo } : cardInfo;
                
                gameEnv.neutralizedEffects[targetPlayerId].specificCards.push(cardToNeutralize);
            }
        }
        
        // Add game event for neutralization completed
        this.addGameEvent(gameEnv, 'CARD_SELECTION_COMPLETED', {
            playerId: playerId,
            selectionId: selectionId,
            selectedCards: selectedCardIds,
            effectType: 'neutralizeEffect',
            targetPlayerId: targetPlayerId
        });
        
        // Clean up the pending selection
        delete gameEnv.pendingCardSelections[selectionId];
        delete gameEnv.pendingPlayerAction;
        
        // Check if turn should advance after card selection completion
        // This completes the card play action that triggered the selection
        const isMainPhaseComplete = await this.checkIsMainPhaseComplete(gameEnv);
        
        if (!isMainPhaseComplete) {
            // Continue turn-based play - players still need to place character/help cards
            const oldPlayer = gameEnv.currentPlayer;
            gameEnv = await this.shouldUpdateTurn(gameEnv, playerId);
            
            // Add turn switch event if player changed
            if (gameEnv.currentPlayer !== oldPlayer) {
                this.addGameEvent(gameEnv, 'TURN_SWITCH', {
                    oldPlayer: oldPlayer,
                    newPlayer: gameEnv.currentPlayer,
                    turn: gameEnv.currentTurn
                });
            }
        }
        
        return gameEnv;
    }
    
    /**
     * Apply set power to selected cards
     * @param {Object} gameEnv - Current game environment
     * @param {string} selectionId - ID of the pending selection
     * @param {Array} selectedCardIds - Array of selected card IDs to modify
     */
    async applySetPowerSelection(gameEnv, selectionId, selectedCardIds) {
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, targetPlayerId, effect } = selection;
        
        // Initialize field effects structure if it doesn't exist
        if (!gameEnv.players[targetPlayerId].fieldEffects) {
            gameEnv.players[targetPlayerId].fieldEffects = {
                zoneRestrictions: {},
                activeEffects: [],
                specialEffects: {},
                calculatedPowers: {},
                disabledCards: [],
                victoryPointModifiers: 0
            };
        }
        
        // Initialize calculatedPowers if it doesn't exist
        if (!gameEnv.players[targetPlayerId].fieldEffects.calculatedPowers) {
            gameEnv.players[targetPlayerId].fieldEffects.calculatedPowers = {};
        }
        
        // NOTE: setPower effects will be applied AFTER the effect simulation to prevent clearing
        
        // CRITICAL: First run the unified effect simulation to process existing play sequence
        const effectSimulator = require('../services/EffectSimulator');
        await effectSimulator.simulateCardPlaySequence(gameEnv);
        
        // CRITICAL: Now add the setPower effect AFTER simulation (so it doesn't get cleared)
        // This ensures the effect persists and is properly tracked in activeEffects
        for (const cardId of selectedCardIds) {
            const cardInfo = selection.eligibleCards.find(card => card.cardId === cardId);
            if (cardInfo) {
                // Add the setPower effect to activeEffects (after simulation to avoid clearing)
                const setPowerEffect = {
                    effectId: `h-2_maga_nerf_${cardId}_${Date.now()}`,
                    source: "h-2",
                    sourcePlayerId: playerId,
                    type: "setPower",
                    target: {
                        scope: "OPPONENT",
                        zones: ["top", "left", "right"],
                        specificCards: [cardId]
                    },
                    value: effect.value,
                    priority: 0,
                    unremovable: false
                };
                
                // Add to target player's activeEffects (where the effect has impact)
                gameEnv.players[targetPlayerId].fieldEffects.activeEffects.push(setPowerEffect);
                
                // Also update calculatedPowers directly for immediate effect
                gameEnv.players[targetPlayerId].fieldEffects.calculatedPowers[cardId] = effect.value;
                
                console.log(`Set power effect recorded in activeEffects: Card ${cardId} power set to ${effect.value} by ${playerId}'s h-2 card`);
            }
        }
        
        // CRITICAL: Update valueOnField in zone cards to match the new setPower effects
        for (const cardId of selectedCardIds) {
            const cardInfo = selection.eligibleCards.find(card => card.cardId === cardId);
            if (cardInfo) {
                // Find the card in the target player's zones and update valueOnField
                const targetZones = gameEnv.zones[targetPlayerId];
                for (const zoneName of ['top', 'left', 'right', 'help', 'sp']) {
                    if (targetZones[zoneName]) {
                        for (const cardObj of targetZones[zoneName]) {
                            if (cardObj.card && cardObj.card[0] === cardId) {
                                cardObj.valueOnField = effect.value;
                                console.log(`Updated ${cardId} valueOnField to ${effect.value} in zone ${zoneName} (from setPower effect)`);
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        // CRITICAL: Recalculate playerPoint for target player after setPower effect
        gameEnv.players[targetPlayerId].playerPoint = await this.calculatePlayerPoint(gameEnv, targetPlayerId);
        console.log(`Updated ${targetPlayerId} playerPoint to ${gameEnv.players[targetPlayerId].playerPoint} after setPower effect`);
        
        // Add game event for set power completed
        this.addGameEvent(gameEnv, 'CARD_SELECTION_COMPLETED', {
            playerId: playerId,
            selectionId: selectionId,
            selectedCards: selectedCardIds,
            effectType: 'setPower',
            targetPlayerId: targetPlayerId,
            powerValue: effect.value
        });
        
        // Clean up the pending selection
        delete gameEnv.pendingCardSelections[selectionId];
        delete gameEnv.pendingPlayerAction;
        
        // Check if turn should advance after card selection completion
        const isMainPhaseComplete = await this.checkIsMainPhaseComplete(gameEnv);
        
        if (!isMainPhaseComplete) {
            // Continue turn-based play
            const oldPlayer = gameEnv.currentPlayer;
            gameEnv = await this.shouldUpdateTurn(gameEnv, playerId);
            
            // Add turn switch event if player changed
            if (gameEnv.currentPlayer !== oldPlayer) {
                this.addGameEvent(gameEnv, 'TURN_SWITCH', {
                    oldPlayer: oldPlayer,
                    newPlayer: gameEnv.currentPlayer,
                    currentTurn: gameEnv.currentTurn
                });
            }
        } else {
            // Main phase complete - advance to SP phase
            gameEnv = await this.advanceToSpPhaseOrBattle(gameEnv);
        }
        
        return gameEnv;
    }
    
    /**
     * Complete a pending card selection by the player
     * @param {Object} gameEnv - Current game environment
     * @param {string} selectionId - ID of the pending selection
     * @param {Array} selectedCardIds - Array of selected card IDs
     * @returns {Object} Updated game environment or error
     */
    async completeCardSelection(gameEnv, selectionId, selectedCardIds) {
        if (!gameEnv.pendingCardSelections || !gameEnv.pendingCardSelections[selectionId]) {
            return this.throwError("Invalid or expired card selection");
        }
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, eligibleCards, searchedCards, selectCount, effect, effectType, targetPlayerId } = selection;
        
        // Validate selection
        if (selectedCardIds.length !== selectCount) {
            return this.throwError(`Must select exactly ${selectCount} cards`);
        }
        
        for (const cardId of selectedCardIds) {
            // For neutralization and setPower effects, validate against card structure
            if (effectType === 'neutralizeEffect' || effectType === 'setPower') {
                const isValidCard = eligibleCards.some(card => 
                    (typeof card === 'string' && card === cardId) || 
                    (typeof card === 'object' && card.cardId === cardId)
                );
                if (!isValidCard) {
                    return this.throwError(`Invalid card selection: ${cardId}`);
                }
            } else {
                if (!eligibleCards.includes(cardId)) {
                    return this.throwError(`Invalid card selection: ${cardId}`);
                }
            }
        }
        
        // Handle different effect types
        if (effectType === 'neutralizeEffect') {
            // Apply neutralization to selected cards
            return await this.applyNeutralizationSelection(gameEnv, selectionId, selectedCardIds);
        } else if (effectType === 'setPower') {
            // Apply power modification to selected cards
            return await this.applySetPowerSelection(gameEnv, selectionId, selectedCardIds);
        }
        
        // Apply the selection (for deck search effects)
        const deck = this.getPlayerMainDeck(gameEnv, playerId);
        const hand = this.getPlayerHand(gameEnv, playerId);
        
        // Add selected cards to appropriate destination
        for (const cardId of selectedCardIds) {
            // Remove from deck first
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
            }
            // Add to destination based on effect
            if (effect.destination === 'spZone') {
                // Create card object for SP zone placement (face-down by default)
                const cardDetails = require('./mozDeckHelper').getDeckCardDetails(cardId);
                const cardObj = {
                    "card": [cardId],
                    "cardDetails": [cardDetails],
                    "isBack": [true], // SP cards placed face-down via search effects
                    "valueOnField": cardDetails["power"] || 0
                };
                const playerField = this.getPlayerField(gameEnv, playerId);
                playerField.sp.push(cardObj);
            } else if (effect.destination === 'helpZone') {
                // Always place in Help zone (original fixed destination)
                const cardDetails = require('./mozDeckHelper').getDeckCardDetails(cardId);
                if (!cardDetails || cardDetails.cardType !== 'help') {
                    return this.throwError("Selected card is not a Help card");
                }
                
                // Create card object for Help zone placement
                const cardObj = {
                    "card": [cardId],
                    "cardDetails": [cardDetails],
                    "isBack": [false],
                    "valueOnField": cardDetails["power"] || 0
                };
                const playerField = this.getPlayerField(gameEnv, playerId);
                playerField.help.push(cardObj);
                
                // Process Help card onPlay effects (since it's being "played" to the zone)
                const effectResult = await this.processUtilityCardEffects(gameEnv, playerId, cardDetails);
                if (effectResult && effectResult.requiresCardSelection) {
                    return effectResult.gameEnv;
                }
            } else if (effect.destination === 'conditionalHelpZone') {
                // Check Help zone status at placement time to determine destination
                const cardDetails = require('./mozDeckHelper').getDeckCardDetails(cardId);
                if (!cardDetails || cardDetails.cardType !== 'help') {
                    return this.throwError("Selected card is not a Help card");
                }
                
                const playerField = this.getPlayerField(gameEnv, playerId);
                if (playerField.help.length === 0) {
                    // Help zone is empty - place card in Help zone
                    const cardObj = {
                        "card": [cardId],
                        "cardDetails": [cardDetails],
                        "isBack": [false],
                        "valueOnField": cardDetails["power"] || 0
                    };
                    const playerField = this.getPlayerField(gameEnv, playerId);
                playerField.help.push(cardObj);
                    
                    // Process Help card onPlay effects (since it's being "played" to the zone)
                    const effectResult = await this.processUtilityCardEffects(gameEnv, playerId, cardDetails);
                    if (effectResult && effectResult.requiresCardSelection) {
                        return effectResult.gameEnv;
                    }
                } else {
                    // Help zone is occupied - place card in hand instead
                    hand.push(cardId);
                }
            } else {
                // Default to hand for backward compatibility
                hand.push(cardId);
            }
        }
        
        // Put remaining searched cards to bottom of deck
        const remainingSearched = searchedCards.filter(cardId => !selectedCardIds.includes(cardId));
        for (const cardId of remainingSearched) {
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
                deck.push(cardId); // Add to bottom
            }
        }
        
        // Clean up the pending selection and player action indicator
        delete gameEnv.pendingCardSelections[selectionId];
        delete gameEnv.pendingPlayerAction;
        
        return gameEnv;
    }
    
    /**
     * Forces a player to draw cards from their deck
     * Used by card effects like "bitcoin 真香" (draw 2 cards)
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player who should draw cards
     * @param {number} count - Number of cards to draw
     */
    async drawCardsForPlayer(gameEnv, playerId, count) {
        for (let i = 0; i < count; i++) {
            const hand = this.getPlayerHand(gameEnv, playerId);
            const mainDeck = this.getPlayerMainDeck(gameEnv, playerId);
            const result = mozDeckHelper.drawToHand(hand, mainDeck);
            this.setPlayerHand(gameEnv, playerId, result["hand"]);
            this.setPlayerMainDeck(gameEnv, playerId, result["mainDeck"]);
        }
    }
    
    /**
     * Forces a player to randomly discard cards from their hand
     * Used by card effects like "You have no card" (discard 2 cards if opponent has >4 cards)
     * @param {Object} gameEnv - Current game environment
     * @param {string} targetPlayerId - Player who should discard cards
     * @param {number} count - Number of cards to discard
     */
    async discardRandomCards(gameEnv, targetPlayerId, count) {
        const hand = this.getPlayerHand(gameEnv, targetPlayerId);
        for (let i = 0; i < count && hand.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * hand.length);
            hand.splice(randomIndex, 1);
        }
    }
    
    /**
     * Checks if SP phase is needed before battle resolution
     * SP phase occurs when any player has played SP cards
     * @param {Object} gameEnv - Current game environment
     * @returns {boolean} True if SP phase is needed
     */
    async checkNeedsSpPhase(gameEnv) {
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        
        // Check if any player has SP cards on the field
        for (const playerId of playerList) {
            const spZone = this.getPlayerZone(gameEnv, playerId, 'sp');
            if (spZone && spZone.length > 0) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Checks if a player should skip Help phase because Help zone is already occupied
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if Help phase should be skipped
     */
    shouldSkipHelpPhase(gameEnv, playerId) {
        const helpZone = this.getPlayerZone(gameEnv, playerId, 'help');
        return helpZone && helpZone.length > 0;
    }

    /**
     * Checks if a player should skip SP phase because SP zone is already occupied
     * @param {Object} gameEnv - Current game environment  
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if SP phase should be skipped
     */
    shouldSkipSpPhase(gameEnv, playerId) {
        const spZone = this.getPlayerZone(gameEnv, playerId, 'sp');
        return spZone && spZone.length > 0;
    }

    /**
     * Determines if current player should skip the current phase due to zone occupation
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @param {string} phase - Current phase to check
     * @returns {boolean} True if phase should be skipped
     */
    shouldSkipCurrentPhase(gameEnv, playerId, phase) {
        switch (phase) {
            case 'HELP_PHASE':
                return this.shouldSkipHelpPhase(gameEnv, playerId);
            case TurnPhase.SP_PHASE:
                return this.shouldSkipSpPhase(gameEnv, playerId);
            default:
                return false;
        }
    }
    
    /**
     * Advances to SP phase or directly to battle with phase skipping logic
     * Skips SP phase if all players have SP zones already occupied
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Current player ID
     * @returns {Object} Updated game environment
     */
    async advanceToSpPhaseOrBattle(gameEnv, playerId) {
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        
        // Check if SP phase should be skipped for all players
        let allPlayersShouldSkipSp = true;
        
        for (const checkPlayerId of playerList) {
            const shouldSkip = this.shouldSkipSpPhase(gameEnv, checkPlayerId);
            const hand = this.getPlayerHand(gameEnv, checkPlayerId) || [];
            
            // If any player has cards in hand and their SP zone isn't pre-occupied, they can play any card face-down
            if (hand.length > 0 && !shouldSkip) {
                allPlayersShouldSkipSp = false;
            }
        }

        // Also check if there are any SP cards already on the field that need to execute effects
        const hasSpCardsOnField = await this.checkNeedsSpPhase(gameEnv);

        if (!allPlayersShouldSkipSp || hasSpCardsOnField) {
            // Start SP phase - some players can play SP cards or SP effects need to execute
            console.log('Starting SP phase - players can play SP cards or SP effects need to execute');
            return await this.startSpPhase(gameEnv);
        } else {
            // Skip SP phase entirely - all SP zones pre-occupied and no SP cards on field
            console.log('Skipping SP phase - all SP zones are pre-occupied or no SP cards present');
            return await this.concludeLeaderBattleAndNewStart(gameEnv, playerId);
        }
    }


    /**
     * Starts the SP phase - executes all SP card effects in priority order
     * SP cards execute based on leader initial points (highest first)
     * @param {Object} gameEnv - Current game environment
     * @returns {Object} Updated game environment after SP phase
     */
    async startSpPhase(gameEnv) {
        mozPhaseManager.setCurrentPhase(TurnPhase.SP_PHASE);
        gameEnv["phase"] = mozPhaseManager.currentPhase;
        
        // Execute all SP cards in priority order (leader initial points determine order)
        await this.executeSpCardsInPriorityOrder(gameEnv);
        
        // After SP phase completes, proceed to battle resolution
        return await this.concludeLeaderBattleAndNewStart(gameEnv, gameEnv["currentPlayer"]);
    }
    
    /**
     * Executes all SP cards in priority order based on leader initial points
     * Higher leader initial points = higher priority = executes first
     * @param {Object} gameEnv - Current game environment
     */
    async executeSpCardsInPriorityOrder(gameEnv) {
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);
        const spCardPriorities = [];
        
        // Collect all face-up SP cards with their player's leader priority
        for (const playerId of playerList) {
            const leader = this.cardInfoUtils.getCurrentLeader(gameEnv, playerId);
            const spCards = this.getPlayerZone(gameEnv, playerId, 'sp') || [];
            
            for (const spCardObj of spCards) {
                // Only process face-up SP cards
                if (!spCardObj.isBack[0]) {
                    spCardPriorities.push({
                        playerId,
                        cardObj: spCardObj,
                        leaderPriority: leader.initialPoint || 0
                    });
                }
            }
        }
        
        // Sort by leader initial points (highest priority executes first)
        spCardPriorities.sort((a, b) => b.leaderPriority - a.leaderPriority);
        
        // Execute SP card effects in priority order
        const utilityCards = require('../data/utilityCards.json');
        for (const spCard of spCardPriorities) {
            const cardData = utilityCards.cards[spCard.cardObj.cardDetails[0].id];
            if (cardData && cardData.effects && cardData.effects.rules) {
                for (const rule of cardData.effects.rules) {
                    // Execute SP phase specific effects
                    if (rule.type === 'triggered' && rule.trigger.event === 'spPhase') {
                        await this.executeEffectRule(rule, gameEnv, spCard.playerId);
                    }
                }
            }
        }
    }
    
    static getPlayerFromGameEnv(gameEnv) {
        return getPlayerFromGameEnv(gameEnv);
    }

    isSummonBattleEnd(gameEnv){
        var returnValue = false;
        if(gameEnv["phase"] == TurnPhase.END_LEADER_BATTLE){
            returnValue = true;
        }
        return returnValue;
    }

    /**
     * Process SP zone reveal and battle calculation after both players fill SP zones
     */
    async processSpRevealAndBattle(gameEnv) {
        // Phase 1: Reveal all SP zone cards
        const allPlayers = Object.keys(gameEnv).filter(key => key.startsWith('playerId_'));
        const spCards = [];
        
        for (const playerId of allPlayers) {
            const spZone = this.getPlayerZone(gameEnv, playerId, 'sp');
            if (spZone && spZone.length > 0) {
                const spCard = spZone[0];
                // Reveal the card
                spCard.isBack = [false];
                
                // Collect SP cards for priority execution
                if (spCard.cardDetails[0].cardType === "sp") {
                    spCards.push({
                        playerId,
                        card: spCard.cardDetails[0],
                        priority: this.getPlayerZone(gameEnv, playerId, 'leader').initialPoint
                    });
                }
            }
        }
        
        // Phase 2: Execute SP effects in priority order (higher initialPoint first, first player breaks ties)
        spCards.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // Higher priority first
            }
            // If same priority, first player (playerId_1) goes first
            return a.playerId.localeCompare(b.playerId);
        });
        
        // Execute pre-combo SP effects
        for (const spCardInfo of spCards) {
            await this.executeSPCardEffect(gameEnv, spCardInfo.playerId, spCardInfo.card, "before");
        }
        
        // Phase 3: Calculate battle results (power + combos)
        const battleResults = await this.calculateBattleResults(gameEnv);
        
        // Phase 4: Execute post-combo SP effects
        for (const spCardInfo of spCards) {
            await this.executeSPCardEffect(gameEnv, spCardInfo.playerId, spCardInfo.card, "after");
        }
        
        // Phase 5: Recalculate final results after post-combo effects
        const finalResults = await this.calculateBattleResults(gameEnv);
        
        // Set battle phase and return results
        gameEnv["phase"] = TurnPhase.BATTLE_PHASE;
        gameEnv["battleResults"] = finalResults;
        gameEnv["spRevealComplete"] = true;
        
        return gameEnv;
    }
    
    /**
     * Execute SP card effect based on timing
     */
    async executeSPCardEffect(gameEnv, playerId, spCard, timing) {
        if (!spCard.effects || !spCard.effects.rules) return;
        
        for (const rule of spCard.effects.rules) {
            // Determine if this effect should execute before or after combo calculation
            const isAfterCombo = this.isAfterComboEffect(rule);
            
            if ((timing === "before" && !isAfterCombo) || (timing === "after" && isAfterCombo)) {
                await this.executeEffectRule(gameEnv, playerId, rule);
            }
        }
    }
    
    /**
     * Determine if SP effect should execute after combo calculation
     */
    isAfterComboEffect(rule) {
        if (!rule.effect) return false;
        
        // Check for effects that modify combo results or total power after calculation
        const afterComboKeywords = ["combo", "組合", "總能力", "total power", "特殊組合", "總能力結算"];
        const description = rule.effect.description || "";
        
        return afterComboKeywords.some(keyword => description.includes(keyword));
    }
    
    /**
     * Calculate battle results including power and combos
     */
    async calculateBattleResults(gameEnv) {
        const results = {};
        const allPlayers = Object.keys(gameEnv).filter(key => key.startsWith('playerId_'));
        
        for (const playerId of allPlayers) {
            // Calculate power (excluding face-down cards)
            const power = await this.calculatePlayerPower(gameEnv, playerId);
            
            // Calculate combo bonuses (excluding face-down cards)
            const combos = await this.calculatePlayerCombos(gameEnv, playerId);
            
            results[playerId] = {
                power,
                combos,
                totalPoints: power + combos.totalBonus
            };
        }
        
        // Determine winner
        const playerResults = allPlayers.map(pid => ({
            playerId: pid,
            totalPoints: results[pid].totalPoints
        }));
        
        playerResults.sort((a, b) => b.totalPoints - a.totalPoints);
        results.winner = playerResults[0];
        results.battleComplete = true;
        
        return results;
    }
}
module.exports = new mozGamePlay();