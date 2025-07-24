// =======================================================================================
// 🎯 TURN MANAGER - Clean Class Implementation for Turn and Phase Logic
// =======================================================================================
//
// This class handles ALL turn and phase management with clear switch-case routing.
// Extracted from the massive mozGamePlay.js for better maintainability.
//
// Key Features:
// - Clear turn switching logic with automatic player alternation
// - Phase progression management (MAIN_PHASE → SP_PHASE → BATTLE_PHASE)
// - Automatic turn skipping when players have no valid moves
// - Phase skipping logic for pre-occupied zones
// - Comprehensive logging for debugging and tracking
// - Event generation for frontend synchronization
//
// Turn Flow:
// 1. Player plays card → shouldUpdateTurn() checks if turn complete
// 2. If complete → startNewTurn() switches players and draws card
// 3. checkIsMainPhaseComplete() determines if ready for SP phase
// 4. advanceToSpPhaseOrBattle() handles phase progression with skipping
//
// =======================================================================================

const { getPlayerFromGameEnv } = require('../utils/gameUtils');

const TurnPhase = {
    START_REDRAW: "START_REDRAW",
    DRAW_PHASE: "DRAW_PHASE", 
    MAIN_PHASE: "MAIN_PHASE",
    SP_PHASE: "SP_PHASE",
    BATTLE_PHASE: "BATTLE_PHASE",
    END_PHASE: "END_PHASE",
    GAME_END: "GAME_END"
};

class TurnManager {
    constructor(mozGamePlay) {
        this.mozGamePlay = mozGamePlay;
        
        // Helper method references for cleaner code
        this.getPlayerData = mozGamePlay.getPlayerData.bind(mozGamePlay);
        this.getPlayerHand = mozGamePlay.getPlayerHand.bind(mozGamePlay);
        this.getPlayerMainDeck = mozGamePlay.getPlayerMainDeck.bind(mozGamePlay);
        this.setPlayerHand = mozGamePlay.setPlayerHand.bind(mozGamePlay);
        this.setPlayerMainDeck = mozGamePlay.setPlayerMainDeck.bind(mozGamePlay);
        this.getPlayerField = mozGamePlay.getPlayerField.bind(mozGamePlay);
        this.addGameEvent = mozGamePlay.addGameEvent.bind(mozGamePlay);
        this.getPlayerFromGameEnv = getPlayerFromGameEnv;
        this.getPlayerZone = mozGamePlay.getPlayerZone.bind(mozGamePlay);
        
        // Import required helpers
        this.mozDeckHelper = require('../mozGame/mozDeckHelper');
    }

    // =======================================================================================
    // 🎯 MAIN TURN MANAGEMENT - Core Turn Switching Logic
    // =======================================================================================

    /**
     * 🎯 SHOULD UPDATE TURN - Check if Current Turn is Complete
     * 
     * Determines if the current player's turn should end based on:
     * - Whether they played a card this turn
     * - Whether they should skip due to no valid moves
     * - Whether there's a pending card selection
     * 
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Current player ID
     * @returns {Object} Updated game environment (may include turn switch)
     */
    async shouldUpdateTurn(gameEnv, playerId) {
        console.log(`🎯 TurnManager: Checking if turn should update for player: ${playerId}`);
        
        let currentTurnActionComplete = false;
        let shouldSkipTurn = false;
        
        // ===== STEP 1: CHECK IF PLAYER COMPLETED THEIR TURN ACTION =====
        if (gameEnv.phase === TurnPhase.MAIN_PHASE) {
            const playerAction = this.getPlayerData(gameEnv, playerId).turnAction;
            const currentTurn = gameEnv.currentTurn;
            
            // Check if player played a card this turn
            for (let idx in playerAction) {
                if ((playerAction[idx].type === "PlayCard" || 
                     playerAction[idx].type === "PlayCardBack") &&
                    playerAction[idx].turn === currentTurn) {
                    currentTurnActionComplete = true;
                    console.log(`🎯 Player ${playerId} completed turn action - played card`);
                    break;
                }
            }
            
            // ===== STEP 2: CHECK IF PLAYER SHOULD SKIP TURN =====
            if (!currentTurnActionComplete) {
                shouldSkipTurn = await this.shouldPlayerSkipTurn(gameEnv, playerId);
                if (shouldSkipTurn) {
                    console.log(`🎯 Player ${playerId} automatically skipping turn - no valid placements available`);
                    currentTurnActionComplete = true;
                }
            }
        }
        
        // ===== STEP 3: SWITCH TURNS IF COMPLETE AND NO PENDING SELECTIONS =====
        if (currentTurnActionComplete && !gameEnv.pendingPlayerAction) {
            console.log(`🎯 Turn complete - switching to next player`);
            gameEnv = await this.startNewTurn(gameEnv);
        } else if (gameEnv.pendingPlayerAction) {
            console.log(`🎯 Turn switch delayed - pending card selection must be completed first`);
        } else {
            console.log(`🎯 Turn continues - player ${playerId} still has actions available`);
        }
        
        return gameEnv;
    }

    /**
     * 🎯 SHOULD PLAYER SKIP TURN - Auto-Skip Logic
     * 
     * Determines if a player should automatically skip their turn because:
     * - They have no cards in hand
     * - All character zones are occupied
     * - Help zone is occupied (any card can be played face-down here)
     * 
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if player should skip their turn
     */
    async shouldPlayerSkipTurn(gameEnv, playerId) {
        console.log(`🎯 TurnManager: Checking if player ${playerId} should skip turn`);
        
        // ===== STEP 1: CHECK IF PLAYER HAS CARDS TO PLAY =====
        const hand = this.getPlayerHand(gameEnv, playerId) || [];
        if (hand.length === 0) {
            console.log(`🎯 Player ${playerId} should skip - no cards in hand`);
            return true;
        }
        
        // ===== STEP 2: CHECK CHARACTER ZONES AVAILABILITY =====
        const playerField = this.getPlayerField(gameEnv, playerId);
        const characterZones = ['top', 'left', 'right'];
        
        for (const zone of characterZones) {
            if (!playerField[zone] || playerField[zone].length === 0) {
                console.log(`🎯 Player ${playerId} should not skip - ${zone} zone available for character cards`);
                return false; // Found available character zone
            }
        }
        
        // ===== STEP 3: CHECK HELP ZONE AVAILABILITY =====
        // Help zone is special - any card can be played face-down here
        if (!playerField.help || playerField.help.length === 0) {
            console.log(`🎯 Player ${playerId} should not skip - help zone available for any card (face-down)`);
            return false; // Help zone is available - any card can be played face-down
        }
        
        console.log(`🎯 Player ${playerId} should skip - all zones are occupied`);
        return true; // All zones are occupied, player should skip turn
    }

    /**
     * 🎯 START NEW TURN - Switch Players and Draw Card
     * 
     * Core turn switching logic:
     * 1. Increment turn counter
     * 2. Alternate current player based on turn number
     * 3. Transition to DRAW_PHASE
     * 4. Current player draws 1 card
     * 5. Generate events for frontend
     * 
     * @param {Object} gameEnv - Current game environment
     * @returns {Object} Updated game environment with new turn
     */
    async startNewTurn(gameEnv) {
        console.log(`🎯 TurnManager: Starting new turn ${gameEnv.currentTurn + 1}`);
        
        // ===== STEP 1: INCREMENT TURN COUNTER =====
        gameEnv.currentTurn = gameEnv.currentTurn + 1;
        const playerArr = this.getPlayerFromGameEnv(gameEnv);
        
        // ===== STEP 2: ALTERNATE CURRENT PLAYER =====
        // Turn 0,2,4,6... = firstPlayer, Turn 1,3,5,7... = other player
        if (gameEnv.currentTurn % 2 === 0) {
            gameEnv.currentPlayer = playerArr[gameEnv.firstPlayer];
        } else {
            const otherPlayerIdx = gameEnv.firstPlayer === 0 ? 1 : 0;
            gameEnv.currentPlayer = playerArr[otherPlayerIdx];
        }
        
        console.log(`🎯 Turn ${gameEnv.currentTurn}: Current player is now ${gameEnv.currentPlayer}`);
        
        // ===== STEP 3: TRANSITION TO DRAW_PHASE =====
        gameEnv.phase = TurnPhase.DRAW_PHASE;
        
        // ===== STEP 4: CURRENT PLAYER DRAWS 1 CARD =====
        const currentPlayer = gameEnv.currentPlayer;
        const hand = this.getPlayerHand(gameEnv, currentPlayer);
        const mainDeck = this.getPlayerMainDeck(gameEnv, currentPlayer);
        const result = this.mozDeckHelper.drawToHand(hand, mainDeck);
        
        this.setPlayerHand(gameEnv, currentPlayer, result.hand);
        this.setPlayerMainDeck(gameEnv, currentPlayer, result.mainDeck);
        
        console.log(`🎯 Player ${currentPlayer} drew 1 card - hand size: ${result.hand.length}`);
        
        // ===== STEP 5: GENERATE EVENTS FOR FRONTEND =====
        this.addGameEvent(gameEnv, 'DRAW_PHASE_COMPLETE', {
            playerId: currentPlayer,
            cardCount: 1,
            newHandSize: result.hand.length,
            requiresAcknowledgment: true
        });
        
        this.addGameEvent(gameEnv, 'TURN_SWITCH', {
            newPlayer: currentPlayer,
            turn: gameEnv.currentTurn,
            phase: 'DRAW_PHASE'
        });
        
        return gameEnv;
    }

    // =======================================================================================
    // 🎮 PHASE MANAGEMENT - Main Phase Completion and Progression Logic
    // =======================================================================================

    /**
     * 🎮 CHECK IS MAIN PHASE COMPLETE - Determine Phase Progression
     * 
     * Main phase is complete when all required zones are filled:
     * - All character zones (top, left, right) for all players  
     * - All help zones for all players
     * 
     * @param {Object} gameEnv - Current game environment
     * @returns {boolean} True if main phase is complete
     */
    async checkIsMainPhaseComplete(gameEnv) {
        console.log(`🎮 TurnManager: Checking if main phase is complete`);
        
        // ===== STEP 1: VALIDATE PHASE =====
        if (gameEnv.phase !== TurnPhase.MAIN_PHASE) {
            console.log(`🎮 Not in main phase (${gameEnv.phase}) - cannot check completion`);
            return false;
        }
        
        // ===== STEP 2: CHECK CHARACTER ZONES =====
        // Delegate to existing checkIsSummonBattleReady for character zone validation
        const isCharacterZonesFilled = await this.mozGamePlay.checkIsSummonBattleReady(gameEnv);
        if (!isCharacterZonesFilled) {
            console.log(`🎮 Main phase not complete - character zones not all filled`);
            return false;
        }
        
        // ===== STEP 3: CHECK HELP ZONES =====
        const playerList = this.getPlayerFromGameEnv(gameEnv);
        
        for (const playerId of playerList) {
            const helpZone = this.getPlayerZone(gameEnv, playerId, 'help');
            
            // Help zone must have at least one card (face-up or face-down)
            if (!helpZone || helpZone.length === 0) {
                console.log(`🎮 Main phase not complete - ${playerId} missing card in help zone`);
                return false;
            }
        }
        
        console.log(`🎮 Main phase complete - all required zones filled for all players`);
        return true;
    }

    /**
     * 🎮 ADVANCE TO SP PHASE OR BATTLE - Phase Progression with Skipping
     * 
     * Handles transition from MAIN_PHASE to either:
     * - SP_PHASE: If any player can play SP cards or SP effects need execution
     * - BATTLE_PHASE: If all SP zones are occupied and no SP cards on field
     * 
     * @param {Object} gameEnv - Current game environment
     * @returns {Object} Updated game environment with new phase
     */
    async advanceToSpPhaseOrBattle(gameEnv) {
        console.log(`🎮 TurnManager: Advancing from main phase to SP phase or battle`);
        
        // ===== STEP 1: CHECK IF ANY PLAYER CAN PLAY SP CARDS =====
        const playerList = this.getPlayerFromGameEnv(gameEnv);
        let allPlayersShouldSkipSp = true;
        
        for (const playerId of playerList) {
            const shouldSkip = this.shouldSkipSpPhase(gameEnv, playerId);
            const hand = this.getPlayerHand(gameEnv, playerId) || [];
            
            // If any player has cards in hand and their SP zone isn't pre-occupied, they can play any card face-down
            if (hand.length > 0 && !shouldSkip) {
                allPlayersShouldSkipSp = false;
                console.log(`🎮 Player ${playerId} can play SP cards - SP phase needed`);
                break;
            }
        }
        
        // ===== STEP 2: CHECK FOR EXISTING SP CARDS NEEDING EXECUTION =====
        const hasSpCardsOnField = await this.checkNeedsSpPhase(gameEnv);
        
        // ===== STEP 3: ROUTE TO APPROPRIATE PHASE =====
        if (!allPlayersShouldSkipSp || hasSpCardsOnField) {
            console.log(`🎮 Starting SP phase - players can play SP cards or SP effects need execution`);
            return await this.startSpPhase(gameEnv);
        } else {
            console.log(`🎮 Skipping SP phase - all SP zones pre-occupied and no SP cards on field`);
            return await this.concludeLeaderBattleAndNewStart(gameEnv);
        }
    }
    
    /**
     * 🎮 CHECK NEEDS SP PHASE - Check for Existing SP Cards
     * 
     * Checks if any SP cards are already on the field that need to execute effects
     * 
     * @param {Object} gameEnv - Current game environment
     * @returns {boolean} True if SP phase is needed for existing SP cards
     */
    async checkNeedsSpPhase(gameEnv) {
        console.log(`🎮 TurnManager: Checking if SP phase is needed for existing SP cards`);
        
        const playerList = this.getPlayerFromGameEnv(gameEnv);
        
        for (const playerId of playerList) {
            const playerField = this.getPlayerField(gameEnv, playerId);
            
            if (playerField.sp && playerField.sp.length > 0) {
                console.log(`🎮 SP cards found on field for ${playerId} - SP phase needed`);
                return true;
            }
        }
        
        console.log(`🎮 No SP cards on field - SP phase not needed`);
        return false;
    }
    
    /**
     * 🎮 START SP PHASE - Begin SP Phase Execution
     * 
     * Delegates to mozGamePlay's startSpPhase method for SP card execution
     * 
     * @param {Object} gameEnv - Current game environment
     * @returns {Object} Updated game environment
     */
    async startSpPhase(gameEnv) {
        console.log(`🎮 TurnManager: Starting SP phase execution`);
        
        // Delegate to mozGamePlay for SP card execution logic
        return await this.mozGamePlay.startSpPhase(gameEnv);
    }
    
    /**
     * 🎮 CONCLUDE LEADER BATTLE AND NEW START - End Current Battle
     * 
     * Delegates to mozGamePlay's concludeLeaderBattleAndNewStart method
     * 
     * @param {Object} gameEnv - Current game environment
     * @returns {Object} Updated game environment
     */
    async concludeLeaderBattleAndNewStart(gameEnv) {
        console.log(`🎮 TurnManager: Concluding leader battle and starting new round`);
        
        // Delegate to mozGamePlay for battle conclusion logic
        return await this.mozGamePlay.concludeLeaderBattleAndNewStart(gameEnv, null);
    }

    // =======================================================================================
    // 🔍 PHASE SKIPPING LOGIC - Zone Occupation Checks
    // =======================================================================================

    /**
     * 🔍 SHOULD SKIP HELP PHASE - Check Help Zone Occupation
     * 
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if Help phase should be skipped
     */
    shouldSkipHelpPhase(gameEnv, playerId) {
        const helpZone = this.getPlayerField(gameEnv, playerId).help;
        const shouldSkip = helpZone && helpZone.length > 0;
        
        if (shouldSkip) {
            console.log(`🔍 TurnManager: Player ${playerId} should skip help phase - zone occupied`);
        }
        
        return shouldSkip;
    }

    /**
     * 🔍 SHOULD SKIP SP PHASE - Check SP Zone Occupation
     * 
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if SP phase should be skipped
     */
    shouldSkipSpPhase(gameEnv, playerId) {
        const spZone = this.getPlayerField(gameEnv, playerId).sp;
        const shouldSkip = spZone && spZone.length > 0;
        
        if (shouldSkip) {
            console.log(`🔍 TurnManager: Player ${playerId} should skip SP phase - zone occupied`);
        }
        
        return shouldSkip;
    }

    /**
     * 🔍 SHOULD SKIP CURRENT PHASE - Generic Phase Skipping Check
     * 
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @param {string} phase - Current phase to check
     * @returns {boolean} True if phase should be skipped
     */
    shouldSkipCurrentPhase(gameEnv, playerId, phase) {
        console.log(`🔍 TurnManager: Checking if player ${playerId} should skip ${phase}`);
        
        switch (phase) {
            case TurnPhase.MAIN_PHASE:
                return this.shouldSkipHelpPhase(gameEnv, playerId);
                
            case TurnPhase.SP_PHASE:
                return this.shouldSkipSpPhase(gameEnv, playerId);
                
            default:
                console.log(`🔍 No skipping logic for phase: ${phase}`);
                return false;
        }
    }

    // =======================================================================================
    // 🔧 UTILITY METHODS
    // =======================================================================================

    /**
     * 🔧 GET CURRENT TURN INFO - Debugging Helper
     * 
     * @param {Object} gameEnv - Current game environment
     * @returns {Object} Current turn information
     */
    getCurrentTurnInfo(gameEnv) {
        return {
            currentTurn: gameEnv.currentTurn,
            currentPlayer: gameEnv.currentPlayer,
            currentPhase: gameEnv.phase,
            playerList: this.getPlayerFromGameEnv(gameEnv),
            firstPlayer: gameEnv.firstPlayer
        };
    }

    /**
     * 🔧 IS PLAYER CURRENT TURN - Check if Player's Turn
     * 
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if it's the player's turn
     */
    isPlayerCurrentTurn(gameEnv, playerId) {
        return gameEnv.currentPlayer === playerId;
    }

    /**
     * 🔧 GET NEXT PLAYER - Get Next Player in Turn Order
     * 
     * @param {Object} gameEnv - Current game environment
     * @returns {string} Next player's ID
     */
    getNextPlayer(gameEnv) {
        const playerList = this.getPlayerFromGameEnv(gameEnv);
        const currentPlayerIndex = playerList.indexOf(gameEnv.currentPlayer);
        const nextPlayerIndex = (currentPlayerIndex + 1) % playerList.length;
        return playerList[nextPlayerIndex];
    }

    /**
     * 📊 LOG TURN SUMMARY - Comprehensive Logging for Debugging
     * 
     * @param {Object} gameEnv - Current game environment
     */
    logTurnSummary(gameEnv) {
        const turnInfo = this.getCurrentTurnInfo(gameEnv);
        console.log(`📊 TurnManager Summary:`, turnInfo);
        
        // Log zone status for all players
        for (const playerId of turnInfo.playerList) {
            const playerField = this.getPlayerField(gameEnv, playerId);
            console.log(`📊 ${playerId} zones:`, {
                top: playerField.top?.length || 0,
                left: playerField.left?.length || 0,
                right: playerField.right?.length || 0,
                help: playerField.help?.length || 0,
                sp: playerField.sp?.length || 0
            });
        }
    }
}

module.exports = TurnManager;