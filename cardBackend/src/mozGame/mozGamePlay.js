const mozDeckHelper = require('./mozDeckHelper');
const mozPhaseManager = require('./mozPhaseManager');
const CardEffectManager = require('../services/CardEffectManager');
const { getPlayerFromGameEnv } = require('../utils/gameUtils');
const CardInfoUtils = require('../services/CardInfoUtils');
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
        gameEnv["firstPlayer"] = firstPlayer;
        mozPhaseManager.setCurrentPhase(TurnPhase.START_REDRAW)
        gameEnv["phase"] = mozPhaseManager.currentPhase;
        for (let playerId in playerList){
            gameEnv[playerList[playerId]].redraw = 0;
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
                handSize: gameEnv[playerId].deck.hand.length
            });
        }
        
        return gameEnv;
    }
    
    async redrawInBegining(gameEnvInput,playerId,isRedraw){
        var gameEnv = gameEnvInput;
        if(gameEnv[playerId].redraw == 0){
            gameEnv[playerId].redraw = 1;
            
            // Add player ready event
            this.addGameEvent(gameEnv, 'PLAYER_READY', {
                playerId: playerId,
                redrawRequested: isRedraw
            });
            
            if (isRedraw){
                const {hand,mainDeck} =  await mozDeckHelper.reshuffleForPlayer(playerId);
                gameEnv[playerId].deck.hand = hand;
                gameEnv[playerId].deck.mainDeck = mainDeck;
                
                // Add hand redrawn event
                this.addGameEvent(gameEnv, 'HAND_REDRAWN', {
                    playerId: playerId,
                    newHandSize: hand.length
                });
            }
        }
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameEnv);

        /*
        when all player have redraw 1 and turnPhase is startRedraw,
        meaning all player is ready to start the game
        so we can change the phase to main phase
        */
        var allReady = true;
        for (let playerId in playerList){
            if(gameEnv[playerList[playerId]].redraw == 0){
                allReady = false;
            } 
        }

        if (allReady && gameEnv["phase"] == TurnPhase.START_REDRAW){
           // Initialize game fields for all players
           for (let playerId in playerList){
               let leader = this.cardInfoUtils.getCurrentLeader(gameEnv, playerList[playerId]);
               gameEnv[playerList[playerId]]["turnAction"] = []
               gameEnv[playerList[playerId]]["Field"] = {};
               gameEnv[playerList[playerId]]["Field"]["leader"] = leader;
               gameEnv[playerList[playerId]]["Field"]["right"] = [];
               gameEnv[playerList[playerId]]["Field"]["left"] = [];
               gameEnv[playerList[playerId]]["Field"]["top"] = [];
               gameEnv[playerList[playerId]]["Field"]["help"] = [];
               gameEnv[playerList[playerId]]["Field"]["sp"] = [];
            }
            
            // Note: Drawing and phase transitions are now handled in GameLogic.startReady()
            // This method only handles the redraw logic during the initial ready phase
        }
        return gameEnv;
    }

    /**
     * Processes a player action in the game
     * Handles card placement, validation, and effect processing for all card types
     * @param {Object} gameEnvInput - Current game environment state
     * @param {string} playerId - ID of the player making the action
     * @param {Object} action - Action object containing type, card_idx, field_idx
     * @returns {Object} Updated game environment or error object
     */
    async processAction(gameEnvInput, playerId, action) {
        var gameEnv = gameEnvInput;
        
        // Check if there's a pending player action that blocks normal gameplay
        if (gameEnv.pendingPlayerAction) {
            const pendingAction = gameEnv.pendingPlayerAction;
            
            // If card selection is pending, block all other actions
            if (pendingAction.type === 'cardSelection') {
                const selection = gameEnv.pendingCardSelections[pendingAction.selectionId];
                if (selection) {
                    if (selection.playerId === playerId) {
                        // Add error event for blocked action
                        this.addErrorEvent(gameEnv, 'CARD_SELECTION_PENDING', `You must complete your card selection first. Select ${selection.selectCount} card(s).`, playerId);
                        return this.throwError(`You must complete your card selection first. Select ${selection.selectCount} card(s).`);
                    } else {
                        // Add error event for waiting
                        this.addErrorEvent(gameEnv, 'WAITING_FOR_PLAYER', `Waiting for ${selection.playerId} to complete card selection. Please wait.`, playerId);
                        return this.throwError(`Waiting for ${selection.playerId} to complete card selection. Please wait.`);
                    }
                }
            }
            
            this.addErrorEvent(gameEnv, 'GAME_BLOCKED', `Game is waiting for player action.`, playerId);
            return this.throwError(`Game is waiting for player action.`);
        }
        
        // Handle card play actions (face up or face down)
        if (action["type"] == "PlayCard" || action["type"] == "PlayCardBack") {
            var isPlayInFaceDown = action["type"] == "PlayCardBack";
            const positionDict = ["top", "left", "right", "help", "sp"];
            
            // Validate field position
            if (action["field_idx"] >= positionDict.length) {
                this.addErrorEvent(gameEnv, 'INVALID_POSITION', "position out of range", playerId);
                return this.throwError("position out of range");
            }
            
            const playPos = positionDict[action["field_idx"]];
            var hand = [...gameEnv[playerId].deck.hand];
            
            // Validate card index in hand
            if (action["card_idx"] >= hand.length) {
                this.addErrorEvent(gameEnv, 'INVALID_CARD_INDEX', "hand card out of range", playerId);
                return this.throwError("hand card out of range");
            }
            
            // Get card details from deck manager
            const cardToPlay = hand[action["card_idx"]];
            const cardDetails = mozDeckHelper.getDeckCardDetails(cardToPlay);
            
            if (!cardDetails) {
                this.addErrorEvent(gameEnv, 'CARD_NOT_FOUND', "Card not found", playerId);
                return this.throwError("Card not found");
            }

            // Check advanced placement restrictions (zone compatibility, special effects)
            // Face-down cards bypass all restrictions since opponent cannot see what's being played
            if (!isPlayInFaceDown) {
                const placementCheck = await this.cardEffectManager.checkSummonRestriction(
                    gameEnv,
                    playerId,
                    cardDetails,
                    playPos
                );

                if (!placementCheck.canPlace) {
                    this.addErrorEvent(gameEnv, 'ZONE_COMPATIBILITY_ERROR', placementCheck.reason, playerId);
                    return this.throwError(placementCheck.reason);
                }

                // Log any override effects that allowed placement
                if (placementCheck.overrideInfo) {
                    console.log(`Card placement allowed due to override from ${placementCheck.overrideInfo.overrideCardType} card: ${placementCheck.overrideInfo.overrideCardId}`);
                    console.log(`Reason: ${placementCheck.overrideInfo.overrideReason}`);
                }
            }

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
                    // Character cards can only go in top/left/right zones
                    if (playPos == "help" || playPos == "sp") {
                        this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "Can't play character card in utility zones", playerId);
                        return this.throwError("Can't play character card in utility zones");
                    }
                    // Ensure only one character per zone (no stacking)
                    if (playPos == "top" || playPos == "left" || playPos == "right") {
                        if (await this.monsterInField(gameEnv[playerId].Field[playPos])) {
                            this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "Character already in this position", playerId);
                            return this.throwError("Character already in this position");
                        }
                    }
                } else if (cardDetails["cardType"] == "help") {
                    // Help cards provide utility effects, only one allowed
                    if (playPos != "help") {
                        this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "Help cards can only be played in help zone", playerId);
                        return this.throwError("Help cards can only be played in help zone");
                    }
                    if (gameEnv[playerId].Field[playPos].length > 0) {
                        this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "Help zone already occupied", playerId);
                        return this.throwError("Help zone already occupied");
                    }
                } else if (cardDetails["cardType"] == "sp") {
                    // SP cards can only be played during SP_PHASE
                    if (gameEnv["phase"] != TurnPhase.SP_PHASE) {
                        this.addErrorEvent(gameEnv, 'PHASE_RESTRICTION_ERROR', "SP cards can only be played during SP phase", playerId);
                        return this.throwError("SP cards can only be played during SP phase");
                    }
                    // SP cards are special powerful effects, only one allowed
                    if (playPos != "sp") {
                        this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "SP cards can only be played in SP zone", playerId);
                        return this.throwError("SP cards can only be played in SP zone");
                    }
                    if (gameEnv[playerId].Field[playPos].length > 0) {
                        this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "SP zone already occupied", playerId);
                        return this.throwError("SP zone already occupied");
                    }
                }
            }

            // Create card object for field placement
            var cardObj = {
                "card": hand.splice(action["card_idx"], 1),        // Remove card from hand
                "cardDetails": [cardDetails],                      // Store card data
                "isBack": [isPlayInFaceDown],                     // Track if face down
                "valueOnField": isPlayInFaceDown ? 0 : cardDetails["power"]  // Power for calculations
            };

            // Update game state with card placement
            gameEnv[playerId].deck.hand = hand;                   // Update hand
            gameEnv[playerId].Field[playPos].push(cardObj);       // Place card on field
            action["selectedCard"] = cardObj;                     // Track action details
            action["turn"] = gameEnv["currentTurn"];
            gameEnv[playerId]["turnAction"].push(action);         // Record action history
            
            // Add successful card placement event
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
            
            // Add zone filled event
            this.addGameEvent(gameEnv, 'ZONE_FILLED', {
                playerId: playerId,
                zone: playPos,
                cardType: cardDetails.cardType,
                isFaceDown: isPlayInFaceDown
            });

            // Process immediate card effects - only for face-up cards
            // SP zone cards do NOT process effects immediately - they wait for reveal phase
            if (!isPlayInFaceDown && playPos !== "sp") {
                let effectResult = null;
                if (cardDetails["cardType"] == "character") {
                    // Character summon effects (e.g., draw cards, search deck)
                    effectResult = await this.processCharacterSummonEffects(gameEnv, playerId, cardDetails);
                } else if (cardDetails["cardType"] == "help") {
                    // Help card play effects (e.g., discard opponent cards, boost power)
                    effectResult = await this.processUtilityCardEffects(gameEnv, playerId, cardDetails);
                }
                
                // Add card effect triggered event
                if (effectResult) {
                    this.addGameEvent(gameEnv, 'CARD_EFFECT_TRIGGERED', {
                        playerId: playerId,
                        cardId: cardDetails.cardId,
                        cardName: cardDetails.name,
                        effectType: cardDetails.cardType === "character" ? "onSummon" : "onPlay",
                        requiresSelection: effectResult.requiresCardSelection || false
                    });
                }
                
                // Check if card effect requires user selection
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
                    return effectResult;
                }
            }
            
            // Check if both players have filled SP zones - trigger reveal phase
            if (gameEnv["phase"] == TurnPhase.SP_PHASE && playPos == "sp") {
                const allPlayers = Object.keys(gameEnv).filter(key => key.startsWith('playerId_'));
                const allSpZonesFilled = allPlayers.every(pid => 
                    gameEnv[pid].Field.sp && gameEnv[pid].Field.sp.length > 0
                );
                
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
            
            // Recalculate player points with all active effects
            gameEnv[playerId]["playerPoint"] = await this.calculatePlayerPoint(gameEnv, playerId);
            
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
        gameEnv[crtPlayer]["playerPoint"] = await this.calculatePlayerPoint(gameEnv,crtPlayer);
        gameEnv[opponent]["playerPoint"] = await this.calculatePlayerPoint(gameEnv,opponent);
        
        // Initialize victory points if not present
        if(!gameEnv[crtPlayer].hasOwnProperty("victoryPoints")){
            gameEnv[crtPlayer]["victoryPoints"] = 0;
        }
        if(!gameEnv[opponent].hasOwnProperty("victoryPoints")){
            gameEnv[opponent]["victoryPoints"] = 0;
        }
        
        // Determine round winner and award victory points
        var leaderBattleWinner = "";
        const pointDifference = gameEnv[crtPlayer]["playerPoint"] - gameEnv[opponent]["playerPoint"];
        
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
        gameEnv[opponent]['turnAction'].push(
            this.endBattleObject(leaderBattleWinner,gameEnv["currentTurn"]));
        gameEnv[crtPlayer]['turnAction'].push(
            this.endBattleObject(leaderBattleWinner,gameEnv["currentTurn"]));
        gameEnv[opponent].Field["top"] = [];
        gameEnv[opponent].Field["right"] = [];
        gameEnv[opponent].Field["left"] = [];
        gameEnv[crtPlayer].Field["top"] = [];
        gameEnv[crtPlayer].Field["right"] = [];
        gameEnv[crtPlayer].Field["left"] = [];
        gameEnv[crtPlayer]["playerPoint"] = 0;
        gameEnv[opponent]["playerPoint"] = 0;

        // Check if this was the last leader battle  
        if(gameEnv[opponent].deck.currentLeaderIdx == gameEnv[opponent].deck.leader.length-1){
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
            gameEnv[opponent].deck.currentLeaderIdx = gameEnv[opponent].deck.currentLeaderIdx + 1;
            let opponentLeader = this.cardInfoUtils.getCurrentLeader(gameEnv, opponent);
            gameEnv[opponent].Field["leader"] = opponentLeader
            
            gameEnv[crtPlayer].deck.currentLeaderIdx = gameEnv[crtPlayer].deck.currentLeaderIdx + 1; 
            let crtLeader = this.cardInfoUtils.getCurrentLeader(gameEnv, crtPlayer);
            gameEnv[crtPlayer].Field["leader"] = crtLeader
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
                const monsterArr = gameEnv[player].Field[area[areaIdx]];
                var areaContainMonster = false;
                for(let monsterArrIdx in monsterArr){
                   if(monsterArr[monsterArrIdx]["isBack"][0]){
                        areaContainMonster = true;
                   }else if(monsterArr[monsterArrIdx]["cardDetails"][0]["cardType"] == "character"){
                        areaContainMonster = true;
                        break;
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
            const helpZone = gameEnv[playerId].Field.help;
            
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
            const helpZone = gameEnv[playerId].Field.help;
            
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
            const playerAction = gameEnv[playerId]["turnAction"];
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
        
        if(currentTurnActionComplete){
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
        const hand = gameEnv[playerId].deck.hand || [];
        if (hand.length === 0) {
            return true; // No cards to play
        }

        // Check if any character zone is available
        const characterZones = ['top', 'left', 'right'];
        for (const zone of characterZones) {
            const zoneCards = gameEnv[playerId].Field[zone] || [];
            const hasCharacter = await this.monsterInField(zoneCards);
            if (!hasCharacter) {
                return false; // Found available character zone
            }
        }
        
        // Check if Help zone is available (any card can be played face-down here)
        const helpZone = gameEnv[playerId].Field.help || [];
        if (helpZone.length === 0) {
            return false; // Help zone is available - any card can be played face-down
        }
        
        return true; // All zones are occupied, player should skip turn
    }

    async startNewTurn(gameEnvInput){
        var gameEnv = gameEnvInput;
        gameEnv["currentTurn"] = gameEnv["currentTurn"] + 0.5;
        const playerArr = mozGamePlay.getPlayerFromGameEnv(gameEnv)
        gameEnv["currentPlayer"] = playerArr[gameEnv["firstPlayer"]];
        if(gameEnv["currentTurn"] * 10 % 10 == 5){
            if(gameEnv["firstPlayer"] == 0){
                gameEnv["currentPlayer"] = playerArr[1];
            }else{
                gameEnv["currentPlayer"] = playerArr[0];
            }
        }
        
        // Transition to DRAW_PHASE for the new turn player
        gameEnv["phase"] = TurnPhase.DRAW_PHASE;
        
        // Current player draws 1 card
        var hand = gameEnv[gameEnv["currentPlayer"]].deck.hand
        var mainDeck = gameEnv[gameEnv["currentPlayer"]].deck.mainDeck   
        const result = mozDeckHelper.drawToHand(hand,mainDeck);
        gameEnv[gameEnv["currentPlayer"]].deck.hand = result["hand"];
        gameEnv[gameEnv["currentPlayer"]].deck.mainDeck = result["mainDeck"];
        
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
        const playerField = gameEnv[playerId].Field;
        const currentLeader = playerField.leader;
        
        // Load all card data for effect processing
        const characterCards = require('../data/characterCards.json');
        const utilityCards = require('../data/utilityCards.json');
        const leaderCards = require('../data/leaderCards.json');
        
        // Step 1: Calculate base power for each face-up character card
        let characterPowers = {};
        for (const zone of fields) {
            if (playerField[zone] && playerField[zone].length > 0) {
                for (const cardObj of playerField[zone]) {
                    // Only count face-up character cards for power calculation
                    if (cardObj.cardDetails[0].cardType === 'character' && !cardObj.isBack[0]) {
                        const cardId = cardObj.cardDetails[0].id;
                        const basePower = cardObj.cardDetails[0].power || 0;
                        characterPowers[cardId] = { basePower, zone, modifiers: 0 };
                    }
                }
            }
        }
        
        // Step 2: Apply leader continuous effects (always active)
        if (currentLeader && currentLeader.effects && currentLeader.effects.rules) {
            for (const rule of currentLeader.effects.rules) {
                if (rule.type === 'continuous') {
                    characterPowers = this.applyEffectRule(rule, characterPowers, playerField, gameEnv, playerId, 'leader');
                }
            }
        }
        
        // Step 3: Apply utility card continuous effects (help and SP cards)
        const utilityZones = ['help', 'sp'];
        for (const zone of utilityZones) {
            if (playerField[zone] && playerField[zone].length > 0) {
                for (const cardObj of playerField[zone]) {
                    // Only apply effects from face-up utility cards
                    if (!cardObj.isBack[0]) {
                        const cardId = cardObj.cardDetails[0].id;
                        const utilityCard = utilityCards.cards[cardId];
                        if (utilityCard && utilityCard.effects && utilityCard.effects.rules) {
                            for (const rule of utilityCard.effects.rules) {
                                if (rule.type === 'continuous') {
                                    characterPowers = this.applyEffectRule(rule, characterPowers, playerField, gameEnv, playerId, 'utility');
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
        
        // Step 5: Add combo bonuses for special card combinations
        const comboBonus = this.calculateComboBonus(characterPowers, characterCards, gameEnv, playerId);
        totalPoints += comboBonus;
        
        return totalPoints;
    }

    async getMonsterPoint(card,leader){
        var returnValue = card["power"];
        const cardAttr = card["traits"];
        const leaderNativeAddition = leader["nativeAddition"];
        var addVal = {}
        for(let key in leaderNativeAddition){
            addVal[leaderNativeAddition[key]["type"]] = leaderNativeAddition[key]["value"];
        }
        for(let key in cardAttr){
            if (addVal.hasOwnProperty(cardAttr[key])){
                returnValue += addVal[cardAttr[key]];
            }
        }
        return returnValue;
    }
    async checkIsPlayOkForAction(gameEnv,playerId,action){
        var returnValue = false;
        
        // Get card details to check card type
        const hand = gameEnv[playerId].deck.hand;
        console.log("hand", JSON.stringify(hand));
        if (!hand || action["card_idx"] >= hand.length) {
            return false;
        }
        
        const cardToPlay = hand[action["card_idx"]];
        const cardDetails = mozDeckHelper.getDeckCardDetails(cardToPlay);
        if (!cardDetails) {
            return false;
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

    
    isCardMatchingLeader(card, leader, area ){
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

    applyEffectRule(rule, characterPowers, playerField, gameEnv, playerId, sourceType) {
        // Check if rule conditions are met
        if (!this.checkRuleConditions(rule.trigger.conditions, playerField, gameEnv, playerId)) {
            return characterPowers;
        }
        
        // Apply effect based on target
        const targets = this.getEffectTargets(rule.target, playerField, gameEnv, playerId);
        
        for (const target of targets) {
            if (rule.effect.type === 'modifyPower') {
                const cardId = target.cardId;
                if (characterPowers[cardId]) {
                    if (rule.effect.operation === 'add') {
                        characterPowers[cardId].modifiers += rule.effect.value;
                    } else if (rule.effect.operation === 'set') {
                        characterPowers[cardId].modifiers = rule.effect.value - characterPowers[cardId].basePower;
                    }
                }
            }
        }
        
        return characterPowers;
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
                const opponentHandCount = gameEnv[opponentId].deck.hand.length;
                if (opponentHandCount <= condition.value) return false;
            } else if (condition.type === 'zoneEmpty') {
                const zone = condition.zone;
                if (playerField[zone] && playerField[zone].length > 0) return false;
            } else if (condition.type === 'opponentHasCharacterWithName') {
                const opponentId = this.getOpponentId(gameEnv, playerId);
                const hasCharacter = this.hasCharacterWithName(gameEnv[opponentId].Field, condition.value);
                if (!hasCharacter) return false;
            } else if (condition.type === 'opponentHasLeader') {
                const opponentId = this.getOpponentId(gameEnv, playerId);
                const hasLeader = gameEnv[opponentId].Field.leader && gameEnv[opponentId].Field.leader.name && gameEnv[opponentId].Field.leader.name.includes(condition.value);
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
            }
        }
        
        return true;
    }
    
    hasCharacterWithName(playerField, name) {
        const fields = ['top', 'left', 'right'];
        for (const zone of fields) {
            if (playerField[zone] && playerField[zone].length > 0) {
                for (const cardObj of playerField[zone]) {
                    if (cardObj.cardDetails[0].name && cardObj.cardDetails[0].name.includes(name)) {
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
            targetField = gameEnv[opponentId].Field;
        }
        
        if (!targetField) return targets;
        
        for (const zone of fields) {
            if (targetField[zone] && targetField[zone].length > 0) {
                for (const cardObj of targetField[zone]) {
                    if (this.matchesFilters(cardObj, target.filters)) {
                        targets.push({ cardId: cardObj.cardDetails[0].id, zone, cardObj });
                        if (target.limit && targets.length >= target.limit) {
                            return targets;
                        }
                    }
                }
            }
        }
        
        return targets;
    }
    
    matchesFilters(cardObj, filters) {
        if (!filters || filters.length === 0) return true;
        
        for (const filter of filters) {
            if (filter.type === 'hasTrait') {
                const traits = cardObj.cardDetails[0].traits || [];
                if (!traits.includes(filter.value)) return false;
            } else if (filter.type === 'hasGameType') {
                const gameType = cardObj.cardDetails[0].gameType;
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
        if (!this.checkRuleConditions(rule.trigger.conditions, gameEnv[playerId].Field, gameEnv, playerId)) {
            return {
                success: false,
                reason: 'Effect conditions not met'
            };
        }
        
        // Determine target player (self or opponent)
        const targetPlayerId = rule.target.owner === 'opponent' ? this.getOpponentId(gameEnv, playerId) : playerId;
        
        // Execute different types of triggered effects
        if (rule.effect.type === 'drawCard') {
            // Force target to draw cards from deck
            await this.drawCardsForPlayer(gameEnv, targetPlayerId, rule.effect.value);
            return {
                success: true,
                effectType: 'drawCard',
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
        } else if (rule.effect.type === 'forcePlaySP') {
            // Force opponent to play SP card in next SP phase
            gameEnv[targetPlayerId]['forcedSpPlay'] = true;
            return {
                success: true,
                effectType: 'forcePlaySP',
                executed: true
            };
        }
        
        // Unknown effect type
        return {
            success: false,
            reason: `Unknown effect type: ${rule.effect.type}`
        };
        // Note: Continuous effects (modifyPower, invalidateEffect, etc.) are handled in calculatePlayerPoint
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
        const deck = gameEnv[playerId].deck.mainDeck;
        const hand = gameEnv[playerId].deck.hand;
        
        if (deck.length === 0) return null;
        
        // Look at top N cards from deck
        const searchCount = Math.min(effect.searchCount, deck.length);
        const topCards = deck.slice(0, searchCount);
        
        // Filter cards by type if specified (e.g., only character cards)
        let eligibleCards = topCards;
        if (effect.cardTypeFilter) {
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
        const { playerId, eligibleCards, searchedCards, selectCount, effect } = selection;
        
        // Validate selection
        if (selectedCardIds.length !== selectCount) {
            return this.throwError(`Must select exactly ${selectCount} cards`);
        }
        
        for (const cardId of selectedCardIds) {
            if (!eligibleCards.includes(cardId)) {
                return this.throwError(`Invalid card selection: ${cardId}`);
            }
        }
        
        // Apply the selection
        const deck = gameEnv[playerId].deck.mainDeck;
        const hand = gameEnv[playerId].deck.hand;
        
        // Add selected cards to appropriate destination
        for (const cardId of selectedCardIds) {
            // Remove from deck first
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
            }
            // Add to destination based on effect
            if (effect.destination === 'spZone') {
                // Create card object for SP zone placement
                const cardDetails = require('./mozDeckHelper').getDeckCardDetails(cardId);
                const cardObj = {
                    "card": [cardId],
                    "cardDetails": [cardDetails],
                    "isBack": [false],
                    "valueOnField": cardDetails["power"] || 0
                };
                gameEnv[playerId].Field.sp.push(cardObj);
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
                gameEnv[playerId].Field.help.push(cardObj);
                
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
                
                if (gameEnv[playerId].Field.help.length === 0) {
                    // Help zone is empty - place card in Help zone
                    const cardObj = {
                        "card": [cardId],
                        "cardDetails": [cardDetails],
                        "isBack": [false],
                        "valueOnField": cardDetails["power"] || 0
                    };
                    gameEnv[playerId].Field.help.push(cardObj);
                    
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
            const hand = gameEnv[playerId].deck.hand;
            const mainDeck = gameEnv[playerId].deck.mainDeck;
            const result = mozDeckHelper.drawToHand(hand, mainDeck);
            gameEnv[playerId].deck.hand = result["hand"];
            gameEnv[playerId].deck.mainDeck = result["mainDeck"];
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
        const hand = gameEnv[targetPlayerId].deck.hand;
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
            if (gameEnv[playerId].Field.sp && gameEnv[playerId].Field.sp.length > 0) {
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
        return gameEnv[playerId].Field.help && gameEnv[playerId].Field.help.length > 0;
    }

    /**
     * Checks if a player should skip SP phase because SP zone is already occupied
     * @param {Object} gameEnv - Current game environment  
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if SP phase should be skipped
     */
    shouldSkipSpPhase(gameEnv, playerId) {
        return gameEnv[playerId].Field.sp && gameEnv[playerId].Field.sp.length > 0;
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
            const hand = gameEnv[checkPlayerId].deck.hand || [];
            
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
            const spCards = gameEnv[playerId].Field.sp || [];
            
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
            const spZone = gameEnv[playerId].Field.sp;
            if (spZone && spZone.length > 0) {
                const spCard = spZone[0];
                // Reveal the card
                spCard.isBack = [false];
                
                // Collect SP cards for priority execution
                if (spCard.cardDetails[0].cardType === "sp") {
                    spCards.push({
                        playerId,
                        card: spCard.cardDetails[0],
                        priority: gameEnv[playerId].Field.leader.initialPoint
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