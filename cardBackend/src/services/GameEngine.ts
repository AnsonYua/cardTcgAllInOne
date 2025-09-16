// src/services/GameEngine.ts
// Game execution engine - handles all game state modifications

import { GameEvent, EventFactory, EventStatus, EventPriority } from './EventQueue/interfaces/GameEvent';
import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase, EventType } from '../models/GameEnums';
import { EnergyManager } from './EnergyManager';
import { ShieldCardManager } from './ShieldCardManager';
import { BaseCardManager } from './BaseCardManager';
import { GameNotificationManager } from './GameNotificationManager';
import { PlayerCardManager } from './PlayerCardManager';
import { DeployEffectManager } from './DeployEffectManager';
import { UnitZoneCard, createZoneCard } from '../models/CardSystem';
import { PilotZoneCard } from '../models/CardSystem';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionResult {
    success: boolean;
    error?: string;
}

export class GameEngine {
    private static cardDatabase: any = null;
    // Notification managers created per call - no instance storage
    
    // Static initialization - load card database on first use
    static {
        GameEngine.ensureCardDatabaseLoaded();
    }
    
    /**
     * Get or create notification manager for this game (static version)
     */
    private static getNotificationManager(gameEnv: GameEnvironment): GameNotificationManager {
        // Create new instance per call - no shared state
        return new GameNotificationManager(gameEnv);
    }
    
    /**
     * Load card database into global storage for efficient access (static version)
     */
    private static ensureCardDatabaseLoaded(): void {
        if (!GameEngine.cardDatabase) {
            try {
                const cardDataPath = path.join(__dirname, '../data/st01Card.json');
                const cardFileData = JSON.parse(fs.readFileSync(cardDataPath, 'utf8'));
                // Extract cards from nested structure
                GameEngine.cardDatabase = cardFileData.cards || cardFileData;
                console.log('📚 Card database loaded into global storage');
            } catch (error) {
                console.error('❌ Failed to load card database:', error);
                GameEngine.cardDatabase = {};
            }
        }
    }
    
    /**
     * Get card details from global card database
     */
    public static getCardDetails(cardId: string): any {
        if (!GameEngine.cardDatabase) {
            console.warn('⚠️ Card database not loaded');
            return null;
        }
        return GameEngine.cardDatabase[cardId] || null;
    }
    
    /**
     * Create unique card instance with UUID
     */
    private static createUniqueCardId(originalCardId: string): string {
        let cleanCardId = originalCardId;
        if(originalCardId.split("/").length > 1){
            cleanCardId = originalCardId.split("/")[1];
        }
        // Add UUID to make each card instance unique
        return `${cleanCardId}_${uuidv4()}`;
    }
    
    // ============ SLOT UTILITIES ============
    
    /**
     * Find which slot contains a specific card UID
     */
    public static findSlotByCardUid(player: any, cardUid: string): { slot: string | null, unit: UnitZoneCard | null } {
        const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
        
        for (const slot of slotZones) {
            const slotZone = (player.zones as any)[slot];
            if (slotZone?.unit?.cardUid === cardUid) {
                return { slot, unit: slotZone.unit as UnitZoneCard };
            }
        }
        
        return { slot: null, unit: null };
    }
    
    /**
     * Find first empty unit slot
     */
    public static findFirstEmptySlot(playerZones: any): string | null {
        const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
        
        for (const zone of slotZones) {
            const slotZone = playerZones[zone];
            if (slotZone && !slotZone.unit) {
                return zone;
            }
        }
        
        return null;
    }
    
    // ============ MAIN EXECUTION INTERFACE ============
    
    static execute(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🔥 Executing event: ${event.type}`);
        
        try {
            switch (event.type) {
                case EventType.CREATE_GAME:
                    return GameEngine.executeStartGame(event, gameEnv);
                    
                case EventType.JOIN_GAME:
                    return GameEngine.executeJoinGame(event, gameEnv);
                    
                case EventType.CONFIRM_REDRAW:
                    return GameEngine.executeStartReady(event, gameEnv);
                    
                case EventType.GAMEPLAY_BEGINS:
                    return GameEngine.executeGameStart(event, gameEnv);
                    
                case EventType.ERROR_OCCURRED:
                    return GameEngine.executeErrorEvent(event, gameEnv);
                    
                case EventType.ACKNOWLEDGE_EVENTS:
                    return GameEngine.executeAcknowledgeEvents(event, gameEnv);
                    
                case EventType.PHASE_ADVANCE:
                    return GameEngine.executePhaseAdvance(event, gameEnv);
                    
                case EventType.END_TURN:
                    return GameEngine.executeEndTurn(event, gameEnv);
                    
                case EventType.NEXT_PLAYER_TURN:
                    return GameEngine.executeNextPlayerTurn(event, gameEnv);
                    
                case EventType.PLAY_CARD:
                    return GameEngine.executePlayCard(event, gameEnv);
                    
                case EventType.PLAYER_ACTION:
                    return GameEngine.executePlayerAction(event, gameEnv);
                    
                case EventType.SHIELD_CARD_ATTACKED:
                    return GameEngine.executeShieldCardAttacked(event, gameEnv);
                    
                case EventType.BURST_EFFECT_CHOICE:
                    return GameEngine.executeBurstEffectChoice(event, gameEnv);
                    
                case EventType.DEPLOY_EFFECT_TRIGGERED:
                    return GameEngine.executeDeployEffect(event, gameEnv);
                    
                case EventType.TRIGGER_HEALING:
                    return GameEngine.executeCardEffectTriggered(event, gameEnv);
                    
                default:
                    console.log(`🎯 Processing ${event.type} event - delegating to existing game logic`);
                    return { success: true };
            }
        } catch (error) {
            console.error(`❌ Error executing event ${event.type}:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown execution error'
            };
        }
    }
    
    // ============ EVENT-SPECIFIC EXECUTION METHODS ============
    
    private static executeStartGame(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, gameId } = event.data;
        
        console.log(`🎯 Processing CREATE_GAME event for player: ${playerId}`);
        
        try {
            // Initialize basic game state (moved from GameLogic.createGame)
            gameEnv.playerId_1 = playerId;
            gameEnv.phase = GamePhase.WAITING_FOR_PLAYERS;
            gameEnv.gameStarted = false;
            gameEnv.playersReady = gameEnv.playersReady || {};
            gameEnv.playersReady[playerId] = true;
            
            console.log(`✅ CREATE_GAME event processed - game state initialized for ${playerId}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeStartGame:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'CREATE_GAME execution failed'
            };
        }
    }
    
    private static executeJoinGame(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, gameId } = event.data;
        
        console.log(`🎯 Processing JOIN_GAME event for player: ${playerId}`);
        
        try {
            // Add second player and update phase (moved from GameLogic.joinGame)
            gameEnv.playerId_2 = playerId;
            gameEnv.phase = GamePhase.REDRAW_PHASE;
            gameEnv.gameStarted = true;
            gameEnv.playersReady[playerId] = true;
            
            // Load deck configuration and set up game
            GameEngine.initializeGameWithDecks(gameEnv, playerId);
            
            console.log(`✅ JOIN_GAME event processed - second player ${playerId} added`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeJoinGame:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'JOIN_GAME execution failed'
            };
        }
    }
    
    private static executeStartReady(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, gameId, isRedraw } = event.data;
        
        console.log(`🎯 Processing CONFIRM_REDRAW event for player: ${playerId}, isRedraw: ${isRedraw}`);
        
        try {           
            // Initialize playersReady if not exists
            if (!gameEnv.playersReady) {
                gameEnv.playersReady = {};
            }
            
            // Handle redraw logic
            if (isRedraw) {
                console.log(`🔄 Processing redraw for player ${playerId}`);
                
                const player = gameEnv.players[playerId];
                if (player && player.deck) {
                    // Put current hand back to deck
                    const currentHand = [...player.deck._handUids];
                    player.deck.mainDeck.push(...currentHand);
                    player.deck._handUids = [];
                    
                    console.log(`📤 Returned ${currentHand.length} cards to deck`);
                    
                    // Shuffle the deck again
                    player.deck.mainDeck = GameEngine.shuffleDeck(player.deck.mainDeck);
                    console.log(`🔀 Shuffled deck with ${player.deck.mainDeck.length} cards`);
                    
                    // Assign new 5 hand to player
                    GameEngine.drawCards(player.deck, 5);
                    console.log(`🃏 Drew new hand of ${player.deck._handUids.length} cards`);
                }
            }
            
            // Mark player as ready and set confirmIsRedraw to true (they confirmed their choice)
            gameEnv.playersReady[playerId] = true;
            
            const player = gameEnv.players[playerId];
            if (player) {
                // Store their actual redraw choice and mark as confirmed
                player.isRedraw = isRedraw;
                player.confirmIsRedraw = true; // They confirmed their choice (yes or no)
                console.log(`✅ Player ${playerId} confirmed their redraw choice: ${isRedraw}, confirmIsRedraw: ${player.confirmIsRedraw}`);
            }

            const notificationManager = GameEngine.getNotificationManager(gameEnv);
            
            if(gameEnv.players[playerId].isRedraw){
                notificationManager.notifyRedrawEvent(
                    playerId
                )
            }
            // Note: GAME_START will be triggered automatically by StateBasedActionEngine
            // when it detects both players are ready and confirmed
            
            console.log(`✅ CONFIRM_REDRAW event processed - player ${playerId} marked as ready (redraw: ${isRedraw})`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeStartReady:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'CONFIRM_REDRAW execution failed'
            };
        }
    }
    
    
    private static executeErrorEvent(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { errorReason, errorType, originalEventType, playerId } = event.data;
        
        console.log(`💥 Processing error: ${errorType} - ${errorReason}`);
        
        try {
            // Add error event using GameNotificationManager
            const notificationManager = GameEngine.getNotificationManager(gameEnv);
            notificationManager.notifyError(errorType, errorReason, playerId, originalEventType);
            
            console.log(`📨 Error event added via GameNotificationManager: ${errorReason}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeErrorEvent:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'ERROR_OCCURRED execution failed'
            };
        }
    }
    
    private static executeAcknowledgeEvents(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { eventIds, playerId } = event.data;
        
        console.log(`🎯 Processing ACKNOWLEDGE_EVENTS for ${eventIds.length} events`);
        
        try {
            // Create notification manager and acknowledge events
            const notificationManager = GameEngine.getNotificationManager(gameEnv);
            const acknowledgedCount = notificationManager.acknowledgeEvents(eventIds);
            
            console.log(`✅ ACKNOWLEDGE_EVENTS processed - ${acknowledgedCount} events acknowledged`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeAcknowledgeEvents:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'ACKNOWLEDGE_EVENTS execution failed'
            };
        }
    }
    
    private static executePhaseAdvance(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { actionId, description, affectedPlayers } = event.data;
        
        console.log(`🎯 Processing PHASE_ADVANCE event: ${description}`);
        
        try {
            // Handle specific phase advance actions
            if (actionId && actionId.startsWith('draw_to_main_')) {
                console.log(`🔄 Auto-advancing from DRAW_PHASE to MAIN_PHASE`);
                
                // Change phase directly
                gameEnv.phase = GamePhase.MAIN_PHASE;
                
                // Create phase change event for frontend notification
                const notificationManager = GameEngine.getNotificationManager(gameEnv);
                notificationManager.addNotificationEvent(
                    'PHASE_CHANGE',
                    {
                        fromPhase: 'DRAW_PHASE',
                        toPhase: 'MAIN_PHASE', 
                        reason: 'Auto-advance: No unacknowledged card draw events',
                        playerId: gameEnv.currentPlayer || ''
                    },
                    false, // requiresAcknowledgment
                    'high' // priority
                );
                
                console.log(`✅ Phase successfully advanced to MAIN_PHASE`);
            }
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executePhaseAdvance:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'PHASE_ADVANCE execution failed'
            };
        }
    }
    
    // ============ GAME SETUP HELPERS ============
    
    private static initializeGameWithDecks(gameEnv: GameEnvironment, joinedPlayerId: string): void {
        try {
            console.log('🎮 Initializing game with deck configuration...');
            
            // Load deck configuration
            const deckConfigPath = path.join(__dirname, '../data/gcgdecks.json');
            const deckConfig = JSON.parse(fs.readFileSync(deckConfigPath, 'utf8'));
            
            // Card data is now available via global cardDatabase
            // No need to reload - already loaded in constructor
            
            // Get player IDs
            const playerId1 = gameEnv.playerId_1!;
            const playerId2 = gameEnv.playerId_2!;
            
            // Assign decks to players
            const deck1Config = deckConfig.playerDecks[playerId1] || deckConfig.playerDecks['playerId_1'];
            const deck2Config = deckConfig.playerDecks[playerId2] || deckConfig.playerDecks['playerId_2'];
            
            const deck1Cards = deckConfig.decks[deck1Config.activeDeck].cards;
            const deck2Cards = deckConfig.decks[deck2Config.activeDeck].cards;
            
            // Transform card IDs to unique instances with UUIDs
            const uniqueDeck1Cards = deck1Cards.map((cardId: string) => GameEngine.createUniqueCardId(cardId));
            const uniqueDeck2Cards = deck2Cards.map((cardId: string) => GameEngine.createUniqueCardId(cardId));
            
            // Create and shuffle decks with unique card instances
            const shuffledDeck1 = GameEngine.shuffleDeck([...uniqueDeck1Cards]);
            const shuffledDeck2 = GameEngine.shuffleDeck([...uniqueDeck2Cards]);
            
            console.log(`🎲 Generated ${uniqueDeck1Cards.length} unique cards for player 1`);
            console.log(`🎲 Generated ${uniqueDeck2Cards.length} unique cards for player 2`);
            
            // Random first player selection
            //const firstPlayer = Math.floor(Math.random() * 2); // 0 or 1
            const firstPlayer = 0
            gameEnv.firstPlayer = firstPlayer;
            gameEnv.currentPlayer = firstPlayer === 0 ? playerId1 : playerId2;
            
            // Initialize players with decks using proper PlayerDeck structure
            if (!gameEnv.players[playerId1]) {
                gameEnv.addPlayer(playerId1, 'Player 1');
            }
            const player1 = gameEnv.players[playerId1];
            player1.deck._handUids = [];
            player1.deck.mainDeck = shuffledDeck1;
            
            if (!gameEnv.players[playerId2]) {
                gameEnv.addPlayer(playerId2, 'Player 2');
            }
            const player2 = gameEnv.players[playerId2];
            player2.deck._handUids = [];
            player2.deck.mainDeck = shuffledDeck2;
            
            // Draw initial hands (5 cards each)
            GameEngine.drawCards(gameEnv.players[playerId1].deck, 5);
            GameEngine.drawCards(gameEnv.players[playerId2].deck, 5);
            
            console.log(`🎯 Game initialized: First player is ${gameEnv.currentPlayer}, hands drawn, redraw available`);
            
        } catch (error) {
            console.error('❌ Error initializing game with decks:', error);
            throw error;
        }
    }
    
    private static shuffleDeck(cards: string[]): string[] {
        const shuffled = [...cards];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    private static executeGameStart(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { actionId, description, affectedPlayers } = event.data;
        
        console.log(`🎯 Processing GAME_START state-based action: ${description}`);
        
        try {
            // Determine first and second players based on gameEnv.firstPlayer
            const firstPlayerId = gameEnv.firstPlayer === 0 ? gameEnv.playerId_1! : gameEnv.playerId_2!;
            const secondPlayerId = gameEnv.firstPlayer === 0 ? gameEnv.playerId_2! : gameEnv.playerId_1!;
           
            
            // Allocate starting resources using EnergyManager
            EnergyManager.addExtraEnergy(gameEnv, secondPlayerId);
            EnergyManager.addBasicEnergy(gameEnv, firstPlayerId);

            // Create shield cards for both players using ShieldCardManager
            ShieldCardManager.createShieldCardsFromDeck(gameEnv, firstPlayerId);
            ShieldCardManager.createShieldCardsFromDeck(gameEnv, secondPlayerId);
            
            // Create base cards for both players using BaseCardManager
            BaseCardManager.createBaseCardsFromDeck(gameEnv, firstPlayerId);
            BaseCardManager.createBaseCardsFromDeck(gameEnv, secondPlayerId);

            // Set currentPlayer to firstPlayer
            gameEnv.currentPlayer = firstPlayerId;
            console.log(`🎯 Set current player to first player: ${firstPlayerId}`);
            
            // Advance to DRAW_PHASE (for firstPlayer)
            gameEnv.phase = GamePhase.DRAW_PHASE;
            console.log(`📋 Advanced to DRAW_PHASE for first player turn`);
            
            // Draw 1 card from deck to first player hand
            const firstPlayer = gameEnv.players[firstPlayerId];
            if (firstPlayer && firstPlayer.deck) {
                GameEngine.drawCards(firstPlayer.deck, 1);
                console.log(`🃏 Drew 1 card for first player ${firstPlayerId}`);
            }
            
            // Create game events using GameNotificationManager
            const notificationManager = GameEngine.getNotificationManager(gameEnv);
            
            // Notify about card drawn (requires acknowledgment)
            const drawnCards = firstPlayer?.deck.handUids.slice(-1) || []; // Get last drawn card UID
            notificationManager.notifyCardDrawn(
                firstPlayerId,
                drawnCards,
                firstPlayer?.deck.getHandSize() || 0
            );
            
            console.log(`📨 Created GAMEPLAY_BEGINS and CARD_DRAWN events via GameNotificationManager`);
            
            console.log(`✅ GAMEPLAY_BEGINS event processed - resources allocated, first player set, card drawn, events created`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeGameStart:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'GAMEPLAY_BEGINS execution failed'
            };
        }
    }
    
    private static drawCards(deck: any, count: number): void {
        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (drawnCard) {
                deck._handUids.push(drawnCard);
            }
        }
        console.log(`🃏 Drew ${count} cards, hand size: ${deck._handUids.length}`);
    }
    
    // ============ END TURN SYSTEM ============
    
    private static executeEndTurn(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, currentTurnNumber } = event.data;
        const fromBurst = event.data.fromBurst || false;
        
        console.log(`🏁 Processing END_TURN event for player: ${playerId}, turn: ${currentTurnNumber}, fromBurst: ${fromBurst}`);
        
        try {
            // Check if event.fromBurst - can be empty/undefined (defaults to false)
            if (fromBurst) {
                console.log(`💥 End turn triggered by burst effect - special handling may apply`);
            }
            
            // Validate it's the player's turn
            if (gameEnv.currentPlayer !== playerId) {
                return { 
                    success: false, 
                    error: `Not your turn. Current player: ${gameEnv.currentPlayer}` 
                };
            }
            
            // Simply set phase to END_TURN - let state-based actions handle the transition
            gameEnv.phase = GamePhase.END_PHASE;
            console.log(`🏁 Phase set to END_PHASE - state-based actions will handle next player transition`);
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeEndTurn:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'END_TURN execution failed'
            };
        }
    }
    
    private static executeNextPlayerTurn(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { currentPlayer, nextPlayer, currentTurn } = event.data;
        console.log("current event in nextplayer 111", JSON.stringify(event))
        console.log(`🔄 Processing NEXT_PLAYER_TURN event: ${currentPlayer} → ${nextPlayer}, turn: ${currentTurn} → ${currentTurn + 1}`);
        
        try {
            // Update game state for next player
            gameEnv.currentPlayer = nextPlayer;
            gameEnv.currentTurn = currentTurn + 1;
            gameEnv.phase = GamePhase.DRAW_PHASE;
            
            // Reset repair abilities flag for the new player starting their turn
            const nextPlayerObj = gameEnv.players[nextPlayer];
            if (nextPlayerObj && nextPlayerObj.zones) {
                nextPlayerObj.zones.repairAbilitiesCheckedThisCycle = false;
                console.log(`🩹 Reset repairAbilitiesCheckedThisCycle for player ${nextPlayer}`);
            }
            
            // Unrest current player's cards (via EnergyManager)
            const unrestResult = EnergyManager.untapAllEnergy(gameEnv, nextPlayer);
            
            // Add 1 more energy to current player
            const addEnergyResult = EnergyManager.addBasicEnergy(gameEnv, nextPlayer);
            
            console.log(`✅ Next player turn: ${currentPlayer} → ${nextPlayer}, turn: ${currentTurn} → ${currentTurn + 1}`);
            console.log(`✅ Energy untapped: ${unrestResult} and energy added: ${addEnergyResult}`);
                        // Draw 1 card from deck to first player hand
            const firstPlayer = gameEnv.players[nextPlayer];
            if (firstPlayer && firstPlayer.deck) {
                GameEngine.drawCards(firstPlayer.deck, 1);
                console.log(`🃏 Drew 1 card for first player ${nextPlayer}`);
            }
            
            // Create game events using GameNotificationManager
            const notificationManager = GameEngine.getNotificationManager(gameEnv);
            
            // Notify about card drawn (requires acknowledgment)
            const drawnCards = firstPlayer?.deck.handUids.slice(-1) || []; // Get last drawn card UID
            notificationManager.notifyCardDrawn(
                nextPlayer,
                drawnCards,
                firstPlayer?.deck.getHandSize() || 0
            );
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeNextPlayerTurn:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'NEXT_PLAYER_TURN execution failed'
            };
        }
    }
    
    private static executePlayCard(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        // Pass event data directly to minimize conversions
        const eventData = event.data;
        const fromBurst = eventData.fromBurst || false;
        
        console.log(`🎯 Processing PLAY_CARD event for player: ${eventData.playerId}, cardUID: ${eventData.cardUID}, playAs: ${eventData.playAs}, fromBurst: ${fromBurst}, targetUnit: ${eventData.targetUnit || 'none'}`);
        
        try {
            // Validate it's the player's turn (skip turn validation for burst cards)
            if (!fromBurst && gameEnv.currentPlayer !== eventData.playerId) {
                return {
                    success: false,
                    error: `Not your turn. Current player: ${gameEnv.currentPlayer}`
                };
            }
            
            // Find player
            const player = gameEnv.players[eventData.playerId];
            if (!player || !player.zones) {
                return {
                    success: false,
                    error: `Player ${eventData.playerId} or zones not found`
                };
            }
            
            // Validate card location and remove it (burst cards come from shield, normal cards from hand)
            if (fromBurst) {
                // For burst cards, we don't need to validate/remove from hand since they're being deployed from shield
                console.log(`💥 Burst card deployment: ${eventData.cardUID} - skipping hand validation`);
            } else {
                // Normal card play - validate in hand and remove
                if (!PlayerCardManager.validateCardInHand(gameEnv, eventData.playerId, eventData.cardUID)) {
                    return {
                        success: false,
                        error: `Card ${eventData.cardUID} not found in player ${eventData.playerId} hand`
                    };
                }

                if (!PlayerCardManager.removeCardFromHand(gameEnv, eventData.playerId, eventData.cardUID)) {
                    return {
                        success: false,
                        error: `Failed to remove card ${eventData.cardUID} from player ${eventData.playerId} hand`
                    };
                }
            }

            // Pass event data directly - no intermediate object creation
            const placementResult = PlayerCardManager.placeCardWithEventData(gameEnv, eventData);
            

            
            if (!placementResult.success) {
                // Return card to hand if placement failed (but only for normal cards, not burst cards)
                if (!fromBurst) {
                    player.deck._handUids.push(eventData.cardUID);
                }
                return {
                    success: false,
                    error: placementResult.error
                };
            }

            // ✅ Card placement successful - Check for Deploy effects (ENTERS_PLAY triggers)
            console.log(`✅ Card ${eventData.cardUID} successfully placed for player ${eventData.playerId}`);
            
            // Check for Deploy effects using cardUID to extract cardId and fetch cardData from database
            const deployEffects = this.checkForDeployEffects(eventData.cardUID);
            if (deployEffects.length > 0) {
                console.log(`🚀 Deploy effects detected: ${deployEffects.length} effects for card ${eventData.cardId}`);
                
                // Create and queue Deploy effect events (similar to burst effects)
                const deployEvent = this.createDeployEffectEvent(eventData, deployEffects);
                gameEnv.processingQueue.push(deployEvent);
                
                console.log(`📋 Deploy event queued: ${deployEvent.id}`);
            }

            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executePlayCard:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'PLAY_CARD execution failed'
            };
        }
    }
    
    /**
     * Check if a card has Deploy effects (ENTERS_PLAY triggers) using cardUID to extract cardId and fetch card data
     */
    private static checkForDeployEffects(cardUID: string): any[] {
        console.log("checkForDeployEffects using cardUID:", cardUID);
        
        // Extract cardId from cardUID (format: "cardId_timestamp")
        const cardId = cardUID.split('_')[0];
        console.log("Extracted cardId:", cardId);
        
        // Get card data from database
        const cardData = GameEngine.getCardDetails(cardId);
        if (!cardData) {
            console.log(`⚠️ No card data found for cardId: ${cardId}`);
            return [];
        }
        
        console.log("Retrieved cardData:", JSON.stringify(cardData));
        
        // Check if card has effects and rules
        if (!cardData.effects || !cardData.effects.rules || !Array.isArray(cardData.effects.rules)) {
            console.log(`📝 No deploy effects found - card ${cardId} has no effects.rules array`);
            return [];
        }
        
        const deployEffects = cardData.effects.rules.filter((rule: any) => 
            rule.type === 'triggered' && rule.trigger === 'ENTERS_PLAY'
        );
        
        console.log(`🔍 Deploy effect check for card ${cardId}: found ${deployEffects.length} effects`);
        return deployEffects;
    }
    
    /**
     * Create Deploy effect event for processing queue
     */
    private static createDeployEffectEvent(eventData: any, deployEffects: any[]): GameEvent {
        const deployEvent: GameEvent = {
            id: `deploy_${eventData.cardUID}_${Date.now()}`,
            type: EventType.DEPLOY_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId: eventData.playerId,
            data: {
                cardId: eventData.cardId,
                cardUID: eventData.cardUID,
                cardData: eventData.cardData,
                playerId: eventData.playerId,
                zone: eventData.zone,
                effects: deployEffects,
                timestamp: Date.now()
            },
            timestamp: Date.now()
        };
        
        console.log(`🚀 Created Deploy event: ${deployEvent.id} with ${deployEffects.length} effects`);
        return deployEvent;
    }
    
    private static executePlayerAction(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        // Pass event data directly to minimize conversions
        const eventData = event.data;
        const fromBurst = eventData.fromBurst || false;
        
        console.log(`🗡️ Processing PLAYER_ACTION event for player: ${eventData.playerId}, actionType: ${eventData.actionType}, fromBurst: ${fromBurst}`);
        
        try {
            // Validate it's the player's turn (skip for burst actions)
            if (!fromBurst && gameEnv.currentPlayer !== eventData.playerId) {
                return {
                    success: false,
                    error: `Not your turn. Current player: ${gameEnv.currentPlayer}`
                };
            }
            
            // Handle different action types
            switch (eventData.actionType) {
                case 'attackUnit':
                    return GameEngine.handleAttackUnit(eventData, gameEnv);
                    
                case 'attackShieldArea':
                    return GameEngine.handleAttackShieldArea(eventData, gameEnv);
                    
                default:
                    return {
                        success: false,
                        error: `Unknown actionType: ${eventData.actionType}`
                    };
            }
            
        } catch (error) {
            console.error(`❌ Error in executePlayerAction:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'PLAYER_ACTION execution failed'
            };
        }
    }
    

    /*
    sample request
    {
        "type": "PLAYER_ACTION",
        "playerId": "playerId_2",
        "actionType": "attackUnit",
        "attackerCardUid": "ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84",
        "targetUnitUid": "ST01-005_be13f9a5-9fc9-4e3b-a9b2-fdf999d9f63d",
        "targetSlotName": "slot4",
        "targetPlayerId": "playerId_1",
        "targetPilotUid": "ST01-013_20d620d9-242e-4aa8-b1b6-6847dff89461"
    }
    */
    private static handleAttackUnit(eventData: any, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`⚔️ Processing attackUnit action:`, JSON.stringify(eventData));
        
        try {
            const { 
                playerId, 
                attackerCardUid, 
                targetUnitUid, 
                targetSlotName, 
                targetPlayerId, 
                targetPilotUid 
            } = eventData;
            
            // Get attacker and defender players
            const attacker = gameEnv.getPlayer(playerId);
            const defender = gameEnv.getPlayer(targetPlayerId);
            
            if (!attacker || !defender) {
                return {
                    success: false,
                    error: 'Player not found'
                };
            }
            
            // Find attacker's slot and unit
            const { slot: attackerSlot, unit: attackingUnit } = GameEngine.findSlotByCardUid(attacker, attackerCardUid);
            
            if (!attackerSlot || !attackingUnit) {
                return {
                    success: false,
                    error: `Attacking unit with UID ${attackerCardUid} not found in any slot`
                };
            }
            
            console.log(`⚔️ Found attacking unit in ${attackerSlot}: ${attackingUnit.cardUid}`);
            
            // Find defender's target unit in specified slot
            const defenderSlot = (defender.zones as any)[targetSlotName];
            const targetUnit = defenderSlot?.unit;
            
            if (!targetUnit || targetUnit.cardUid !== targetUnitUid) {
                return {
                    success: false,
                    error: `Target unit with UID ${targetUnitUid} not found in slot ${targetSlotName}`
                };
            }
            
            console.log(`🎯 Found target unit in ${targetSlotName}: ${targetUnit.cardUid}`);
            
            // Calculate attacker's total stats (unit + pilot if present)
            const attackerStats = GameEngine.calculateCombinedStats(attacker, attackerSlot, attackingUnit);
            
            // Calculate defender's total stats (unit + pilot if present)
            const defenderStats = GameEngine.calculateCombinedStats(defender, targetSlotName, targetUnit);
            
            console.log(`⚔️ Attacker total stats: AP=${attackerStats.totalAP}, HP=${attackerStats.totalHP}`);
            console.log(`🛡️ Defender total stats: AP=${defenderStats.totalAP}, HP=${defenderStats.totalHP}`);
            
            // Calculate damage and remaining HP (ensure >= 0)
            const attackerRemainingHP = Math.max(0, attackerStats.totalHP - defenderStats.totalAP);
            const defenderRemainingHP = Math.max(0, defenderStats.totalHP - attackerStats.totalAP);
            
            console.log(`💥 Battle result: Attacker HP: ${attackerStats.totalHP} - ${defenderStats.totalAP} = ${attackerRemainingHP}`);
            console.log(`💥 Battle result: Defender HP: ${defenderStats.totalHP} - ${attackerStats.totalAP} = ${defenderRemainingHP}`);
            
            // Handle attacker damage and destruction
            const attackerDestroyed = GameEngine.handleUnitDamageAndDestruction(
                gameEnv, playerId, attackerSlot, attackingUnit, 'Attacker', 
                attackerRemainingHP, defenderStats.totalAP
            );
            
            // Handle defender damage and destruction
            const defenderDestroyed = GameEngine.handleUnitDamageAndDestruction(
                gameEnv, targetPlayerId, targetSlotName, targetUnit, 'Defender', 
                defenderRemainingHP, attackerStats.totalAP
            );
            
            
            console.log(`⚔️ Attack completed: Attacker ${attackerDestroyed ? 'DESTROYED' : 'SURVIVED'}, Defender ${defenderDestroyed ? 'DESTROYED' : 'SURVIVED'}`);
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in handleAttackUnit:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Attack unit execution failed'
            };
        }
    }
    
    private static handleAttackShieldArea(eventData: any, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🛡️ Processing attackShieldArea action:`, eventData);
        
        try {
            const { playerId, attackerCardUid } = eventData;
            const defendingPlayerId = gameEnv.getOpponentId(playerId);
            
            if (!defendingPlayerId) {
                return {
                    success: false,
                    error: 'Cannot determine defending player'
                };
            }
            
            // Get attacker and defender players
            const attacker = gameEnv.getPlayer(playerId);
            const defender = gameEnv.getPlayer(defendingPlayerId);
            
            if (!attacker || !defender) {
                return {
                    success: false,
                    error: 'Player not found'
                };
            }
            
            // Find which slot contains the attacking card
            const { slot: attackerSlot, unit: attackingUnit } = GameEngine.findSlotByCardUid(attacker, attackerCardUid);
            
            if (!attackerSlot || !attackingUnit) {
                return {
                    success: false,
                    error: `Attacking unit with UID ${attackerCardUid} not found in any slot`
                };
            }
            
            console.log(`⚔️ Found attacking unit in ${attackerSlot}: ${attackingUnit.cardUid}`);
            
            // Calculate total attack power (unit + pilot if paired)
            let totalAttackPower = 0;
            totalAttackPower = attackingUnit.currentAP || 0;
      
            
            // Check for pilot in same slot  
            const attackingPilot = (attacker.zones as any)[attackerSlot]?.pilot;
            if (attackingPilot) {
                let pilotAP = 0;
                pilotAP = (attackingPilot as PilotZoneCard).currentAP || attackingPilot.cardData?.ap || 0;
                totalAttackPower += pilotAP;
                console.log(`⚔️ Attack includes pilot AP: ${pilotAP} (Total: ${totalAttackPower})`);
            }
            
            console.log(`⚔️ Total attack power: ${totalAttackPower}`);
            
            // Check defender's base area
            const defenderBases = defender.zones.base;
            
            if (defenderBases.length > 0) {
                // Base exists - add damage to base[0]
                const baseCard = defenderBases[0];
                const currentDamage = baseCard.damageReceived || 0;
                const newDamage = currentDamage + totalAttackPower;
                
                baseCard.damageReceived = newDamage;
                baseCard.currentHP = Math.max(0, (baseCard.originalHP || 0) - newDamage);
                
                // Check if base is destroyed (HP = 0) and move to trash
                let baseDestroyed = false;
                if (baseCard.currentHP === 0) {
                    // Remove from base zone using BaseCardManager
                    const removed = BaseCardManager.removeBaseCard(gameEnv, defendingPlayerId, baseCard.cardUid);
                    if (removed) {
                        // Move to trash
                        defender.addTrashCard(baseCard.cardUid, baseCard.cardData);
                        baseDestroyed = true;
                        console.log(`💥 Base card ${baseCard.cardUid} destroyed and moved to trash`);
                    }
                }
                
                console.log(`🏰 Base takes ${totalAttackPower} damage (${currentDamage} → ${newDamage}), HP: ${baseCard.currentHP}${baseDestroyed ? ' - DESTROYED!' : ''}`);
                
                // Generate base damage event
                const notificationManager = GameEngine.getNotificationManager(gameEnv);
                notificationManager.addNotificationEvent(
                    baseDestroyed ? 'BASE_DESTROYED' : 'BASE_DAMAGED',
                    {
                        defendingPlayerId,
                        attackingPlayerId: playerId,
                        attackerSlot,
                        damage: totalAttackPower,
                        totalDamage: newDamage,
                        baseHP: baseCard.currentHP,
                        baseDestroyed,
                        ...(baseDestroyed && {
                            destroyedCard: {
                                cardUid: baseCard.cardUid,
                                cardId: baseCard.cardId,
                                name: baseCard.cardData?.name || 'Unknown Base'
                            }
                        })
                    },
                    false,
                    'normal'
                );
                
            } else {
                // Base is empty - attack shields
                if (defender.hasShield()) {
                    // Get shield cards to attack - currently top card only, but easily extensible
                    const shieldCardsToAttack = GameEngine.getShieldCardsToAttack(defender, 1); // Attack 1 card for now
                    
                    console.log(`🛡️ Creating SHIELD_CARD_ATTACKED event for ${shieldCardsToAttack.length} cards`);
                    
                    // Create shield card attacked event with array support for future multi-card attacks
                    const shieldAttackEvent = EventFactory.createShieldCardAttackedEvent(
                        defendingPlayerId,
                        playerId,
                        attackerSlot,
                        shieldCardsToAttack,
                        totalAttackPower
                    );
                    
                    // Add event to the processing queue
                    gameEnv.enqueueForProcessing(shieldAttackEvent);
                    
                    console.log(`🎯 Shield attack event queued: ${shieldAttackEvent.id}`);
                    
                } else {
                    return {
                        success: false,
                        error: 'No shields to attack'
                    };
                }
            }
            
            console.log(`✅ AttackShieldArea completed - Total damage: ${totalAttackPower}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in handleAttackShieldArea:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'AttackShieldArea execution failed'
            };
        }
    }
    
    // ============ SHIELD CARD SELECTION HELPERS ============
    
    /**
     * Get shield cards to attack based on attack power or game rules
     * @param defender - The defending player
     * @param maxCards - Maximum number of cards to attack (1 for current game, could be 2+ in future)
     * @returns Array of shield card data to attack
     */
    private static getShieldCardsToAttack(defender: any, maxCards: number = 1): Array<{cardUid: string, cardId: string, cardData: any}> {
        const availableShields = defender.getShieldCards();
        const cardsToAttack: Array<{cardUid: string, cardId: string, cardData: any}> = [];
        
        // Current game rule: Attack from top of shield area
        // Future game rules could attack multiple cards, specific cards, etc.
        for (let i = 0; i < Math.min(maxCards, availableShields.length); i++) {
            const shieldCard = availableShields[i];
            cardsToAttack.push({
                cardUid: shieldCard.cardUid,
                cardId: shieldCard.cardId,
                cardData: shieldCard.cardData
            });
        }
        
        console.log(`🎯 Selected ${cardsToAttack.length} shield cards to attack (max: ${maxCards})`);
        return cardsToAttack;
    }
    
    // ============ SHIELD CARD ATTACK EVENT EXECUTION ============
    
    /**
     * Execute shield card attacked event - handles card effects processing
     * This is where burst effects like burst_add_to_hand are processed
     */
    private static executeShieldCardAttacked(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🛡️ Executing SHIELD_CARD_ATTACKED event: ${event.id}`);
        
        try {
            const { defendingPlayerId, attackingPlayerId, attackerSlot, shieldCards, attackPower } = event.data;
            
            console.log(`🎯 Processing shield attack - Cards: ${shieldCards.length}, Power: ${attackPower}`);
            
            // Get defending player
            const defender = gameEnv.getPlayer(defendingPlayerId);
            if (!defender) {
                return {
                    success: false,
                    error: `Defending player ${defendingPlayerId} not found`
                };
            }
            
            // Process each attacked shield card
            for (const shieldCard of shieldCards) {
                console.log(`🛡️ Processing shield card: ${shieldCard.cardUid}`);
                
                // Check if card has burst effects with BURST_CONDITION trigger
                const burstEffects = GameEngine.findBurstEffects(shieldCard.cardData);
                
                if (burstEffects.length > 0) {
                    console.log(`💥 Found ${burstEffects.length} burst effect(s) on card ${shieldCard.cardId}`);
                    
                    // Create choice events for each burst effect requiring user confirmation
                    for (const burstEffect of burstEffects) {
                        console.log(`⚡ Creating choice event for burst effect: ${burstEffect.effectId}`);
                        
                        shieldCard.cardData.cardType = shieldCard.cardData.originalCardType
                        const choiceEvent = EventFactory.createBurstEffectChoiceEvent(
                            defendingPlayerId,
                            shieldCard.cardUid,
                            shieldCard.cardId,
                            shieldCard.cardData,
                            burstEffect
                        );
                        
                        // Enqueue the choice event for processing
                        gameEnv.enqueueForProcessing(choiceEvent);
                        
                        console.log(`📤 Enqueued burst choice event: ${choiceEvent.id}`);
                    }
                } else {
                    console.log(`📝 No burst effects found on card ${shieldCard.cardId}`);
                    
                    // Move card to trash if no burst effects
                    console.log(`🗑️ Moving card ${shieldCard.cardUid} to trash (no burst effects)`);
                    
                    // Remove card from shield first
                    const removedFromShield = GameEngine.removeFromShieldWithLogging(gameEnv, defendingPlayerId, shieldCard.cardUid);
                    if (removedFromShield) {
                        
                        // Restore originalCardType before moving to trash (like in burst effects)
                        let cardDataForTrash = { ...shieldCard.cardData };
                        GameEngine.restoreCardType(cardDataForTrash);
                        
                        // Move to trash
                        GameEngine.moveCardToTrash(gameEnv, defendingPlayerId, shieldCard.cardUid, shieldCard.cardId, cardDataForTrash);
                    } else {
                        console.error(`❌ Failed to remove card ${shieldCard.cardUid} from shield before moving to trash`);
                    }
                }
                
            }
            
            // PLACEHOLDER: For now, just acknowledge the event
            // Remove this placeholder and implement the real logic based on card effects
            
            return {
                success: true
            };
            
        } catch (error) {
            console.error(`❌ Error in executeShieldCardAttacked:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Shield card attack execution failed'
            };
        }
    }
    
    /**
     * Handle BURST_EFFECT_CHOICE events - these only execute in RESOLVING status
     * @param event - The burst effect choice event (must be RESOLVING status)
     * @param gameEnv - Current game environment
     */
    private static executeBurstEffectChoice(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`💥 Executing BURST_EFFECT_CHOICE event: ${event.id} (${event.status})`);
        
        try {
            const { playerId, cardUid, cardId, cardData, burstEffect, choiceId, userDecision } = event.data;
            
            // This method should only be called for RESOLVING events
            if (event.status !== EventStatus.RESOLVING) {
                console.log(`⚠️ Unexpected event status: ${event.status} (expected RESOLVING)`);
                return { success: true }; // Skip - should not happen in correct flow
            }
            
            console.log(`🚀 User decided: ${userDecision} for burst choice: ${choiceId}`);
            
            if (userDecision === 'DECLINE') {
                console.log(`❌ Player declined burst effect - moving card to trash area`);
                
                // Get the defending player (card owner)
                const defender = gameEnv.getPlayer(playerId);
                if (!defender) {
                    return {
                        success: false,
                        error: `Player ${playerId} not found`
                    };
                }
                
                // IMPORTANT: Remove card from shield before moving to trash
                const removedFromShield = GameEngine.removeFromShieldWithLogging(gameEnv, playerId, cardUid);
                if (!removedFromShield) {
                    console.log(`⚠️ Warning: Card ${cardUid} was not found in shield zone, but proceeding with trash move`);
                }
                
                // Restore originalCardType before moving to trash (like in ShieldCardManager)
                let cardDataForTrash = { ...cardData };
                GameEngine.restoreCardType(cardDataForTrash);
                
                // Move card to trash area
                defender.addTrashCard(cardUid, cardDataForTrash);
                console.log(`🗑️ Card ${cardId} (${cardUid}) moved to trash area after declining burst effect`);
                
                return { success: true }; // Processing loop will auto-set RESOLVED
            }
            
            if (userDecision === 'ACTIVATE') {
                // Execute the confirmed burst effect
                console.log(`⚡ Executing burst effect: ${burstEffect.type}`);
                const executionResult = GameEngine.executeBurstEffect(gameEnv, playerId, cardUid, cardId, cardData, burstEffect);
                
                if (!executionResult.success) {
                    return executionResult;
                }
                
                console.log(`✅ Burst effect ${burstEffect.type} executed successfully`);
                return { success: true }; // Processing loop will auto-set RESOLVED
            }
            
            // This should never happen if flow is correct
            return {
                success: false,
                error: `Invalid userDecision: ${userDecision}`
            };
            
        } catch (error) {
            console.error(`❌ Error in executeBurstEffectChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Burst effect choice execution failed'
            };
        }
    }
    
    /**
     * Execute Deploy effect triggered by card entering play
     */
    private static executeDeployEffect(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🚀 Executing DEPLOY_EFFECT_TRIGGERED event: ${event.id}`);
        
        try {
            // Use DeployEffectManager to process the Deploy effects
            const result = DeployEffectManager.processDeployEffect(gameEnv, event.data);
            
            if (!result.success) {
                console.log(`❌ Deploy effect processing failed: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }
            
            if (result.requiresSelection) {
                console.log(`🎯 Deploy effects require player selection - workflow set up`);
                return {
                    success: true
                };
            }
            
            console.log(`✅ Deploy effects processed successfully: ${result.message}`);
            return {
                success: true
            };
            
        } catch (error) {
            console.error(`❌ Error in executeDeployEffect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect execution failed'
            };
        }
    }
    
    /**
     * Execute TRIGGER_HEALING event - handles repair and other healing effects
      {
    "id": "state_1758034801142_0.10362686261607723",
    "type": "TRIGGER_HEALING",
    "status": "DECLARED",
    "priority": 1,
    "timestamp": 1758034801142,
    "data": {
      "actionId": "repair_ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84_1758034801142",
      "description": "Execute repair_2 healing for ST01-001",
      "affectedCards": ["ST01-001"],
      "affectedPlayers": ["playerId_2"]
    }
  }
    */
    private static executeCardEffectTriggered(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Executing TRIGGER_HEALING event: ${event.id}`);
        
        try {
            // Process each affected card to determine healing type and amount
            const affectedCards = event.data.affectedCards || [];
            const affectedPlayers = event.data.affectedPlayers || [];
            
            if (affectedCards.length === 0) {
                console.log(`⚠️ No affected cards in TRIGGER_HEALING event`);
                return { success: true };
            }
            
            console.log(`🩹 Processing healing for ${affectedCards.length} card(s): ${affectedCards.join(', ')}`);
            
            // Process each affected card
            for (let i = 0; i < affectedCards.length; i++) {
                const cardId = affectedCards[i];
                const playerId = affectedPlayers[i] || affectedPlayers[0]; // Use corresponding player or first one
                
                // Get card data to determine healing effects
                const cardData = GameEngine.getCardDetails(cardId);
                if (!cardData) {
                    console.log(`❌ Could not find card data for ${cardId}`);
                    continue;
                }
                
                console.log(`🔍 Checking healing effects for card ${cardId}`);
                
                // Look for repair/healing effects in the card
                if (cardData.effects && cardData.effects.rules) {
                    for (const effect of cardData.effects.rules) {
                        if (effect.trigger === 'END_OF_TURN' && effect.effect.action === 'heal') {
                            console.log(`🩹 Found healing effect: ${effect.effectId} (${effect.effect.parameters.amount} HP)`);
                            
                            // Use CardEffect to handle the repair
                            const CardEffect = require('./CardEffect').CardEffect;
                            const healData = {
                                cardId: cardId,
                                playerId: playerId,
                                healAmount: effect.effect.parameters.amount,
                                effectId: effect.effectId,
                                // Include original event data for additional context
                                originalEventData: event.data
                            };
                            
                            const result = CardEffect.executeRepairEffect(gameEnv, healData);
                            
                            if (!result.success) {
                                console.log(`❌ Repair effect failed for ${cardId}: ${result.error}`);
                            } else {
                                console.log(`✅ Repair effect executed for ${cardId}: ${result.message}`);
                            }
                        }
                    }
                } else {
                    console.log(`⚠️ No effects found for card ${cardId}`);
                }
            }
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeCardEffectTriggered:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Card effect execution failed'
            };
        }
    }
    
    /**
     * Find burst effects on a card that should trigger on BURST_CONDITION
     * @param cardData - The card data to search for burst effects
     * @returns Array of burst effects with BURST_CONDITION trigger
     */
    private static findBurstEffects(cardData: any): Array<{ effectId: string; type: string; description: string }> {
        const burstEffects: Array<{ effectId: string; type: string; description: string }> = [];
        
        if (!cardData || !cardData.effects || !cardData.effects.rules) {
            return burstEffects;
        }
        
        // Search through card effects for burst triggers
        for (const effect of cardData.effects.rules) {
            // Check if effect has trigger with BURST_CONDITION
            if (effect.trigger && effect.trigger === 'BURST_CONDITION') {
                // Extract effect type and create description
                const effectType = effect.effect?.action || effect.type || 'unknown';
                const description = GameEngine.createBurstEffectDescription(effect, cardData);
                
                burstEffects.push({
                    effectId: effect.effectId || `burst_${effectType}_${cardData.cardId || 'unknown'}`,
                    type: effectType,
                    description: description
                });
                
                console.log(`🔍 Found burst effect: ${effectType} on card ${cardData.cardId}`);
            }
        }
        
        return burstEffects;
    }
    
    /**
     * Create a human-readable description of a burst effect
     * @param effect - The effect definition
     * @param cardData - The card data
     * @returns Human-readable description string
     */
    private static createBurstEffectDescription(effect: any, cardData: any): string {
        const cardName = cardData.name || cardData.cardId || 'Unknown Card';
        const effectType = effect.effect?.action || effect.type || 'unknown';
        
        switch (effectType) {
            case 'burst_add_to_hand':
                return `【Burst】 ${cardName}: Add this card to your hand`;
            case 'burst_activate_main':
                return `【Burst】 ${cardName}: Activate main effect`;
            case 'burst_deploy':
                return `【Burst】 ${cardName}: Deploy this card to the field`;
            default:
                return `【Burst】 ${cardName}: Activate burst effect (${effectType})`;
        }
    }
    
    /**
     * Execute burst effect for confirmed choice
     * @param gameEnv - Current game environment
     * @param playerId - Player who owns the burst card
     * @param cardUid - Unique ID of the burst card
     * @param cardId - Card ID for reference
     * @param cardData - Full card data
     * @param burstEffect - Burst effect configuration
     */
    static executeBurstEffect(
        gameEnv: GameEnvironment, 
        playerId: string, 
        cardUid: string, 
        cardId: string, 
        cardData: any, 
        burstEffect: any
    ): ExecutionResult {
        console.log(`💥 Executing burst effect ${burstEffect.type} for card ${cardUid}`);
        
        try {
            // Before execution, cardData.cardType should be updated using originalCardType as it always is shield
            GameEngine.restoreCardType(cardData);
            
            // Execute based on burst effect type
            let executionResult: ExecutionResult;
            switch (burstEffect.type) {
                case 'addToHand':
                    executionResult = GameEngine.executeBurstAddToHand(gameEnv, playerId, cardUid, cardData);
                    break;
                    
                case 'deploy':
                    executionResult = GameEngine.executeBurstDeploy(gameEnv, playerId, cardUid, cardData, burstEffect);
                    break;
                    
                default:
                    return {
                        success: false,
                        error: `Unknown burst effect type: ${burstEffect.type}`
                    };
            }
            
            // If burst effect executed successfully, remove the card from shield
            if (executionResult.success) {
                GameEngine.removeFromShieldWithLogging(gameEnv, playerId, cardUid);
            }
            
            return executionResult;
            
        } catch (error) {
            console.error(`❌ Error executing burst effect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Burst effect execution failed'
            };
        }
    }
    
    /**
     * Execute addToHand burst effect - move card from shield to hand
     */
    private static executeBurstAddToHand(gameEnv: GameEnvironment, playerId: string, cardUid: string, cardData: any): ExecutionResult {
        console.log(`➕ Executing addToHand burst effect for card ${cardUid}`);
        
        const player = gameEnv.getPlayer(playerId);
        if (!player) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }
        
        // Add card to hand
        if (!player.deck._handUids) {
            player.deck._handUids = [];
        }
        player.deck._handUids.push(cardUid);
        
        console.log(`✅ Card ${cardUid} (${cardData.name}) added to ${playerId}'s hand`);
        return { success: true };
    }
    
    /**
     * Execute deploy burst effect - create PLAY_CARD event for deployment
     */
    private static executeBurstDeploy(gameEnv: GameEnvironment, playerId: string, cardUid: string, cardData: any, burstEffect: any): ExecutionResult {
        console.log(`🚀 Executing deploy burst effect for card ${cardUid}`);
        console.log("dasfdasfsdfasdafdfsdf  ",JSON.stringify(cardData))
        try {
            // Create PLAY_CARD event for deployment (manual creation based on GameLogic pattern)
            const playCardEvent = {
                id: `burst_deploy_${Date.now()}_${Math.random()}`,
                type: EventType.PLAY_CARD,
                status: EventStatus.DECLARED,
                priority: EventPriority.NORMAL,
                timestamp: Date.now(),
                playerId: playerId,
                data: {
                    playerId: playerId,
                    cardUID: cardUid,
                    playAs: cardData.cardType,
                    fromBurst : true
                }
            };
            
            // Add to processing queue for immediate execution
            gameEnv.processingQueue.push(playCardEvent);
            
            console.log(`✅ Deploy PLAY_CARD event created and queued for card ${cardUid} (playAs: ${playCardEvent.data.playAs})`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error creating deploy PLAY_CARD event:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy event creation failed'
            };
        }
    }
    
    // ============ HELPER METHODS FOR CODE DEDUPLICATION ============
    
    /**
     * Restore card type from originalCardType (centralized logic)
     * @param cardData - Card data to restore type for
     * @returns boolean - true if restoration happened, false if no originalCardType
     */
    private static restoreCardType(cardData: any): boolean {
        if (cardData.originalCardType) {
            console.log(`🔄 Restoring card type: ${cardData.cardType} → ${cardData.originalCardType}`);
            cardData.cardType = cardData.originalCardType;
            return true;
        } else {
            console.log(`⚠️ Warning: No originalCardType found, keeping current cardType: ${cardData.cardType}`);
            return false;
        }
    }
    
    /**
     * Remove card from shield with comprehensive logging
     * @param gameEnv - Game environment
     * @param playerId - Player who owns the shield card
     * @param cardUid - Card to remove from shield
     * @returns boolean - true if successfully removed, false otherwise
     */
    private static removeFromShieldWithLogging(gameEnv: GameEnvironment, playerId: string, cardUid: string): boolean {
        const removed = ShieldCardManager.removeShieldCard(gameEnv, playerId, cardUid);
        if (removed) {
            console.log(`🛡️ Card ${cardUid} successfully removed from ${playerId}'s shield`);
            return true;
        } else {
            console.log(`⚠️ Warning: Could not remove card ${cardUid} from ${playerId}'s shield`);
            return false;
        }
    }
    
    /**
     * Move card to trash area with proper setup and logging
     * @param gameEnv - Game environment
     * @param playerId - Player who owns the card
     * @param cardUid - Card UID
     * @param cardId - Card ID
     * @param cardData - Card data (should have restored cardType)
     * @returns boolean - true if successfully moved to trash, false otherwise
     */
    private static moveCardToTrash(gameEnv: GameEnvironment, playerId: string, cardUid: string, cardId: string, cardData: any): boolean {
        try {
            const player = gameEnv.getPlayer(playerId);
            if (!player || !player.zones) {
                console.error(`❌ Could not find player ${playerId} or zones to move card to trash`);
                return false;
            }
            
            // Initialize trash area if it doesn't exist
            if (!player.zones.trashArea) {
                player.zones.trashArea = [];
            }
            
            // Create trash card with current card data
            const trashCard = createZoneCard(cardUid, cardId, cardData, playerId);
            player.zones.trashArea.push(trashCard);
            
            console.log(`🗑️ Card ${cardUid} (${cardData.name || cardId}) moved to trashArea`);
            return true;
            
        } catch (error) {
            console.error(`❌ Error moving card ${cardUid} to trash:`, error);
            return false;
        }
    }
    
    // ============ ATTACK UTILITIES ============
    
    /**
     * Calculate combined stats (AP + HP) for a unit and its pilot
     * @param player - The player who owns the units
     * @param slotName - The slot name (slot1, slot2, etc.)
     * @param unit - The unit card
     * @returns Combined stats with totalAP and totalHP
     */
    private static calculateCombinedStats(player: any, slotName: string, unit: UnitZoneCard): { totalAP: number, totalHP: number } {
        // Get unit stats
        let totalAP = unit.currentAP || unit.cardData?.ap || 0;
        let totalHP = unit.currentHP || unit.cardData?.hp || 0;
        
        console.log(`📊 Unit stats - AP: ${totalAP}, HP: ${totalHP}`);
        
        // Check for pilot in the same slot
        const pilot = (player.zones as any)[slotName]?.pilot;
        if (pilot) {
            const pilotAP = pilot.currentAP || pilot.cardData?.ap || 0;
            const pilotHP = pilot.currentHP || pilot.cardData?.hp || 0;
            
            totalAP += pilotAP;
            totalHP += pilotHP;
            
            console.log(`👨‍✈️ Pilot stats - AP: ${pilotAP}, HP: ${pilotHP} (Combined: AP=${totalAP}, HP=${totalHP})`);
        } else {
            console.log(`👨‍✈️ No pilot found in ${slotName}`);
        }
        
        return { totalAP, totalHP };
    }
    
    /**
     * Update unit HP after taking damage
     * @param unit - The unit to update
     * @param newHP - The new HP value
     */
    private static updateUnitHP(unit: UnitZoneCard, newHP: number): void {
        unit.currentHP = Math.max(0, newHP);
        console.log(`🩹 Updated unit HP to ${unit.currentHP}`);
    }
    
    /**
     * Update pilot HP after taking damage
     * @param pilot - The pilot to update
     * @param newHP - The new HP value
     */
    private static updatePilotHP(pilot: PilotZoneCard, newHP: number): void {
        pilot.currentHP = Math.max(0, newHP);
        console.log(`🩹 Updated pilot HP to ${pilot.currentHP}`);
    }
    
    /**
     * Handle unit damage, HP updates, and destruction logic
     * @param gameEnv - Game environment
     * @param playerId - Player who owns the unit
     * @param slotName - The slot containing the unit
     * @param unit - The unit to process
     * @param unitLabel - Label for logging (e.g., 'Attacker', 'Defender')
     * @param unitRemainingHP - The unit's remaining HP after damage
     * @param incomingDamage - The damage being dealt to this unit's pilot
     * @returns boolean - true if unit was destroyed, false if it survived
     */
    private static handleUnitDamageAndDestruction(
        gameEnv: GameEnvironment, 
        playerId: string, 
        slotName: string, 
        unit: UnitZoneCard, 
        unitLabel: string,
        unitRemainingHP: number, 
        incomingDamage: number
    ): boolean {
        const player = gameEnv.getPlayer(playerId);
        if (!player) {
            console.error(`❌ Could not find player ${playerId}`);
            return false;
        }

        if (unitRemainingHP <= 0) {
            // Unit is destroyed
            console.log(`💀 ${unitLabel} destroyed! Moving to trash...`);
            GameEngine.moveCardToTrashFromSlot(gameEnv, playerId, slotName, unit, 'unit');
            
            // Also move pilot to trash if present
            const pilot = (player.zones as any)[slotName]?.pilot;
            if (pilot) {
                GameEngine.moveCardToTrashFromSlot(gameEnv, playerId, slotName, pilot, 'pilot');
            }
            
            return true; // Unit destroyed
        } else {
            // Unit survives - update HP
            GameEngine.updateUnitHP(unit, unitRemainingHP);
            
            // Update pilot HP if present
            const pilot = (player.zones as any)[slotName]?.pilot;
            if (pilot) {
                const pilotRemainingHP = Math.max(0, (pilot.currentHP || pilot.cardData?.hp || 0) - incomingDamage);
                GameEngine.updatePilotHP(pilot, pilotRemainingHP);
            }
            
            return false; // Unit survived
        }
    }

    /**
     * Move a card (unit or pilot) to trash area after being destroyed
     * @param gameEnv - Game environment
     * @param playerId - Player who owns the card
     * @param slotName - The slot containing the card
     * @param card - The card to move to trash (unit or pilot)
     * @param cardType - Type of card ('unit' or 'pilot')
     */
    private static moveCardToTrashFromSlot(gameEnv: GameEnvironment, playerId: string, slotName: string, card: UnitZoneCard | PilotZoneCard, cardType: 'unit' | 'pilot'): boolean {
        try {
            const player = gameEnv.getPlayer(playerId);
            if (!player || !player.zones) {
                console.error(`❌ Could not find player ${playerId} or zones`);
                return false;
            }
            
            // Initialize trash area if it doesn't exist
            if (!player.zones.trashArea) {
                player.zones.trashArea = [];
            }
            
            // Create trash card with card data
            const trashCard = createZoneCard(card.cardUid, card.cardId, card.cardData, playerId);
            player.zones.trashArea.push(trashCard);
            
            // Remove card from slot
            const slot = (player.zones as any)[slotName];
            if (slot) {
                if (cardType === 'unit') {
                    slot.unit = null;
                } else if (cardType === 'pilot') {
                    slot.pilot = null;
                }
            }
            
            console.log(`🗑️ ${cardType.charAt(0).toUpperCase() + cardType.slice(1)} ${card.cardUid} moved to trash from ${slotName}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Error moving ${cardType} to trash:`, error);
            return false;
        }
    }
    
}