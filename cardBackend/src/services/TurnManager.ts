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

import { join } from 'path';
import { 
    getPlayerFromGameEnv, 
    getPlayerData, 
    getPlayerField 
} from '../utils/gameUtils';
import { GameEnvironment, Player, PlayerZones, GamePhase } from '../models/GameEnvironment';


interface TurnUpdateResult {
    turnSwitched: boolean;
    gameEnv: GameEnvironment;
}

interface TurnInfo {
    currentTurn: number;
    currentPlayer: string | null;
    currentPhase: string;
    playerList: string[];
    firstPlayer: number;
}

interface ZoneStatus {
    top: number;
    left: number;
    right: number;
    help: number;
    sp: number;
}

class TurnManager {
    private mozGamePlay: any;
    private getPlayerData: (gameEnv: GameEnvironment, playerId: string) => Player | null;
    private getPlayerField: (gameEnv: GameEnvironment, playerId: string) => PlayerZones | null;
    private getPlayerHand: (...args: any[]) => any;
    private getPlayerMainDeck: (...args: any[]) => any;
    private setPlayerHand: (...args: any[]) => any;
    private setPlayerMainDeck: (...args: any[]) => any;
    private addGameEvent: (...args: any[]) => any;
    private getPlayerFromGameEnv: (gameEnv: GameEnvironment) => string[];
    private getPlayerZone: (...args: any[]) => any;
    private mozDeckHelper: any;

    constructor(mozGamePlay: any) {
        this.mozGamePlay = mozGamePlay;
        
        // Helper method references for cleaner code
        // Fix: Use gameUtils functions directly instead of binding non-existent mozGamePlay methods
        this.getPlayerData = getPlayerData;
        this.getPlayerField = getPlayerField;
        this.getPlayerHand = mozGamePlay.getPlayerHand?.bind(mozGamePlay) || (() => {});
        this.getPlayerMainDeck = mozGamePlay.getPlayerMainDeck?.bind(mozGamePlay) || (() => {});
        this.setPlayerHand = mozGamePlay.setPlayerHand?.bind(mozGamePlay) || (() => {});
        this.setPlayerMainDeck = mozGamePlay.setPlayerMainDeck?.bind(mozGamePlay) || (() => {});
        this.addGameEvent = mozGamePlay.addGameEvent?.bind(mozGamePlay) || (() => {});
        this.getPlayerFromGameEnv = getPlayerFromGameEnv;
        this.getPlayerZone = mozGamePlay.getPlayerZone?.bind(mozGamePlay) || (() => {});
        
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
     * @param gameEnv - Current game environment
     * @param playerId - Current player ID
     * @returns Updated game environment (may include turn switch)
     */
    async shouldUpdateTurn(gameEnv: GameEnvironment, playerId: string): Promise<TurnUpdateResult> {
        console.log(`🎯 TurnManager: Checking if turn should update for player: ${playerId}`);
        
        let currentTurnActionComplete = false;
        let shouldSkipTurn = false;
        
        // ===== STEP 1: CHECK IF PLAYER COMPLETED THEIR TURN ACTION =====
        if (gameEnv.phase === GamePhase.MAIN_PHASE) {
            // ✅ CORRECT: Use play sequence to check if player played a card this turn
            const playSequence = gameEnv.playSequenceManager.getPlays() || [];
            const currentTurn = gameEnv.currentTurn;
            
            // Check if player played a card this turn
            for (const play of playSequence) {
                // Check for card play actions by this player in the current turn
                if ((play.action === "PLAY_CARD" || play.action === "PLAY_CARD_BACK") &&
                    play.playerId === playerId &&
                    play.turnNumber === currentTurn) {
                    currentTurnActionComplete = true;
                    console.log(`🎯 Player ${playerId} completed turn action - played card (sequenceId: ${play.sequenceId}, turn: ${play.turnNumber})`);
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
        // REFACTOR: Use consolidated pending selection detection
        const hasPendingSelection = gameEnv.pendingCardSelections && Object.keys(gameEnv.pendingCardSelections).length > 0;
        let turnSwitched = false;

        console.log("aa ", currentTurnActionComplete)
        console.log("aa 12", hasPendingSelection)
        if (currentTurnActionComplete && !hasPendingSelection) {
            console.log(`🎯 Turn complete - switching to next player`);
            await this.startNewTurn(gameEnv);
            turnSwitched = true;
        } else if (hasPendingSelection) {
            console.log(`🎯 Turn switch delayed - pending card selection must be completed first`);
        } else {
            console.log(`🎯 Turn continues - player ${playerId} still has actions available`);
        }
        
        // Return standardized format expected by PostActionHandler
        return { turnSwitched, gameEnv };
    }

    /**
     * 🎯 SHOULD PLAYER SKIP TURN - Auto-Skip Logic
     * 
     * Determines if a player should automatically skip their turn because:
     * - They have no cards in hand
     * - All character zones are occupied
     * - Help zone is occupied (any card can be played face-down here)
     * 
     * @param gameEnv - Current game environment
     * @param playerId - Player ID to check
     * @returns True if player should skip their turn
     */
    async shouldPlayerSkipTurn(gameEnv: GameEnvironment, playerId: string): Promise<boolean> {
        console.log(`🎯 TurnManager: Checking if player ${playerId} should skip turn`);
        
        // ===== STEP 1: CHECK IF PLAYER HAS CARDS TO PLAY =====
        const player = (gameEnv as any).getPlayer(playerId);
        if (!player || player.deck.getHandSize() === 0) {
            console.log(`🎯 Player ${playerId} should skip - no cards in hand`);
            return true;
        }
        
        // ===== STEP 2: CHECK CHARACTER ZONES AVAILABILITY =====
        const playerField = this.getPlayerField(gameEnv, playerId);
        if (!playerField) {
            console.log(`⚠️ TurnManager: Player field not found for ${playerId}, assuming should not skip`);
            return false; // If we can't access player field, don't skip (safer default)
        }
        
        const characterZones: (keyof PlayerZones)[] = ['top', 'left', 'right'];
        
        for (const zone of characterZones) {
            const zoneData = playerField[zone];
            if (!zoneData || (Array.isArray(zoneData) && zoneData.length === 0)) {
                console.log(`🎯 Player ${playerId} should not skip - ${zone} zone available for character cards`);
                return false; // Found available character zone
            }
        }
        
        // ===== STEP 3: CHECK HELP ZONE AVAILABILITY =====
        // Help zone is special - any card can be played face-down here
        const helpZone = playerField.help;
        if (!helpZone || (Array.isArray(helpZone) && helpZone.length === 0)) {
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
     * @param gameEnv - Current game environment
     * @returns Updated game environment with new turn
     */
    async startNewTurn(gameEnv: GameEnvironment): Promise<GameEnvironment> {
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
        gameEnv.phase = GamePhase.DRAW_PHASE;
        
        // ===== STEP 4: CURRENT PLAYER DRAWS 1 CARD =====
        const currentPlayer = gameEnv.currentPlayer;
        const player = (gameEnv as any).getPlayer(currentPlayer);
        
        if (!player) {
            throw new Error(`Player ${currentPlayer} not found`);
        }
        
        // Use PlayerDeckDataResp.drawCard() method instead of mozDeckHelper
        const drawnCardUid = player.deck.drawCard();
        
        if (!drawnCardUid) {
            console.warn(`🎯 Player ${currentPlayer} could not draw card - deck is empty`);
        } else {
            console.log(`🎯 Player ${currentPlayer} drew 1 card - hand size: ${player.deck.getHandSize()}`);
        }
        
        // ===== STEP 5: GENERATE EVENTS FOR FRONTEND =====
        this.addGameEvent(gameEnv, 'DRAW_PHASE_COMPLETE', {
            playerId: currentPlayer,
            cardCount: 1,
            cardUid: drawnCardUid,
            newHandSize: player.deck.getHandSize()
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
     * @param gameEnv - Current game environment
     * @returns True if main phase is complete
     */
    async checkIsMainPhaseComplete(gameEnv: GameEnvironment): Promise<boolean> {
        console.log(`🎮 TurnManager: Checking if main phase is complete`);
        
        // ===== STEP 1: VALIDATE PHASE =====
        if (gameEnv.phase !== GamePhase.MAIN_PHASE) {
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
     * @param gameEnv - Current game environment
     * @returns Updated game environment with new phase
     */
    async advanceToSpPhaseOrBattle(gameEnv: GameEnvironment): Promise<GameEnvironment> {
        console.log(`🎮 TurnManager: Advancing from main phase to SP phase or battle`);
        
        // ===== STEP 1: CHECK IF ANY PLAYER CAN PLAY SP CARDS =====
        const playerList = this.getPlayerFromGameEnv(gameEnv);
        let allPlayersShouldSkipSp = true;
        
        for (const playerId of playerList) {
            const shouldSkip = this.shouldSkipSpPhase(gameEnv, playerId);
            const player = (gameEnv as any).getPlayer(playerId);
            const handSize = player ? player.deck.getHandSize() : 0;
            
            // If any player has cards in hand and their SP zone isn't pre-occupied, they can play any card face-down
            if (handSize > 0 && !shouldSkip) {
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
     * @param gameEnv - Current game environment
     * @returns True if SP phase is needed for existing SP cards
     */
    async checkNeedsSpPhase(gameEnv: GameEnvironment): Promise<boolean> {
        console.log(`🎮 TurnManager: Checking if SP phase is needed for existing SP cards`);
        
        const playerList = this.getPlayerFromGameEnv(gameEnv);
        
        for (const playerId of playerList) {
            const playerField = this.getPlayerField(gameEnv, playerId);
            
            if (playerField && playerField.sp && Array.isArray(playerField.sp) && playerField.sp.length > 0) {
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
     * @param gameEnv - Current game environment
     * @returns Updated game environment
     */
    async startSpPhase(gameEnv: GameEnvironment): Promise<GameEnvironment> {
        console.log(`🎮 TurnManager: Starting SP phase execution`);
        
        // Delegate to mozGamePlay for SP card execution logic
        return await this.mozGamePlay.startSpPhase(gameEnv);
    }
    
    /**
     * 🎮 CONCLUDE LEADER BATTLE AND NEW START - End Current Battle
     * 
     * Delegates to mozGamePlay's concludeLeaderBattleAndNewStart method
     * 
     * @param gameEnv - Current game environment
     * @returns Updated game environment
     */
    async concludeLeaderBattleAndNewStart(gameEnv: GameEnvironment): Promise<GameEnvironment> {
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
     * @param gameEnv - Current game environment
     * @param playerId - Player ID to check
     * @returns True if Help phase should be skipped
     */
    shouldSkipHelpPhase(gameEnv: GameEnvironment, playerId: string): boolean {
        const playerField = this.getPlayerField(gameEnv, playerId);
        if (!playerField) return false;
        
        const helpZone = playerField.help;
        const shouldSkip = !!(helpZone && Array.isArray(helpZone) && helpZone.length > 0);
        
        if (shouldSkip) {
            console.log(`🔍 TurnManager: Player ${playerId} should skip help phase - zone occupied`);
        }
        
        return shouldSkip;
    }

    /**
     * 🔍 SHOULD SKIP SP PHASE - Check SP Zone Occupation
     * 
     * @param gameEnv - Current game environment
     * @param playerId - Player ID to check
     * @returns True if SP phase should be skipped
     */
    shouldSkipSpPhase(gameEnv: GameEnvironment, playerId: string): boolean {
        const playerField = this.getPlayerField(gameEnv, playerId);
        if (!playerField) return false;
        
        const spZone = playerField.sp;
        const shouldSkip = !!(spZone && Array.isArray(spZone) && spZone.length > 0);
        
        if (shouldSkip) {
            console.log(`🔍 TurnManager: Player ${playerId} should skip SP phase - zone occupied`);
        }
        
        return shouldSkip;
    }

    /**
     * 🔍 SHOULD SKIP CURRENT PHASE - Generic Phase Skipping Check
     * 
     * @param gameEnv - Current game environment
     * @param playerId - Player ID to check
     * @param phase - Current phase to check
     * @returns True if phase should be skipped
     */
    shouldSkipCurrentPhase(gameEnv: GameEnvironment, playerId: string, phase: string): boolean {
        console.log(`🔍 TurnManager: Checking if player ${playerId} should skip ${phase}`);
        
        switch (phase) {
            case GamePhase.MAIN_PHASE:
                return this.shouldSkipHelpPhase(gameEnv, playerId);
                
            case GamePhase.SP_PHASE:
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
     * @param gameEnv - Current game environment
     * @returns Current turn information
     */
    getCurrentTurnInfo(gameEnv: GameEnvironment): TurnInfo {
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
     * @param gameEnv - Current game environment
     * @param playerId - Player ID to check
     * @returns True if it's the player's turn
     */
    isPlayerCurrentTurn(gameEnv: GameEnvironment, playerId: string): boolean {
        return gameEnv.currentPlayer === playerId;
    }

    /**
     * 🔧 GET NEXT PLAYER - Get Next Player in Turn Order
     * 
     * @param gameEnv - Current game environment
     * @returns Next player's ID
     */
    getNextPlayer(gameEnv: GameEnvironment): string {
        const playerList = this.getPlayerFromGameEnv(gameEnv);
        const currentPlayer = gameEnv.currentPlayer;
        if (!currentPlayer) {
            throw new Error('Current player is null');
        }
        const currentPlayerIndex = playerList.indexOf(currentPlayer);
        const nextPlayerIndex = (currentPlayerIndex + 1) % playerList.length;
        const nextPlayer = playerList[nextPlayerIndex];
        if (!nextPlayer) {
            throw new Error(`Next player not found at index ${nextPlayerIndex}`);
        }
        return nextPlayer;
    }

    /**
     * 📊 LOG TURN SUMMARY - Comprehensive Logging for Debugging
     * 
     * @param gameEnv - Current game environment
     */
    logTurnSummary(gameEnv: GameEnvironment): void {
        const turnInfo = this.getCurrentTurnInfo(gameEnv);
        console.log(`📊 TurnManager Summary:`, turnInfo);
        
        // Log zone status for all players
        for (const playerId of turnInfo.playerList) {
            const playerField = this.getPlayerField(gameEnv, playerId);
            if (playerField && playerId) {
                const zoneStatus: ZoneStatus = {
                    top: Array.isArray(playerField.top) ? playerField.top.length : 0,
                    left: Array.isArray(playerField.left) ? playerField.left.length : 0,
                    right: Array.isArray(playerField.right) ? playerField.right.length : 0,
                    help: Array.isArray(playerField.help) ? playerField.help.length : 0,
                    sp: Array.isArray(playerField.sp) ? playerField.sp.length : 0
                };
                console.log(`📊 ${playerId} zones:`, zoneStatus);
            }
        }
    }
}

export default TurnManager;