// src/services/GameEngine.ts
// Game execution engine - handles all game state modifications

import { GameEvent } from './EventQueue/interfaces/GameEvent';
import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase, EventType } from '../models/GameEnums';
import { EnergyManager } from './EnergyManager';
import { ShieldCardManager } from './ShieldCardManager';
import { BaseCardManager } from './BaseCardManager';
import { GameNotificationManager } from './GameNotificationManager';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionResult {
    success: boolean;
    error?: string;
}

export class GameEngine {
    private static cardDatabase: any = null;
    private notificationManager: GameNotificationManager | null = null;
    
    constructor() {
        console.log('🎯 GameEngine initialized');
        this.loadCardDatabase();
    }
    
    /**
     * Get or create notification manager for this game
     */
    private getNotificationManager(gameEnv: GameEnvironment): GameNotificationManager {
        if (!this.notificationManager) {
            this.notificationManager = new GameNotificationManager(gameEnv);
        }
        return this.notificationManager;
    }
    
    /**
     * Load card database into global storage for efficient access
     */
    private loadCardDatabase(): void {
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
    private createUniqueCardId(originalCardId: string): string {
        let cleanCardId = originalCardId;
        if(originalCardId.split("/").length > 1){
            cleanCardId = originalCardId.split("/")[1];
        }
        // Add UUID to make each card instance unique
        return `${cleanCardId}_${uuidv4()}`;
    }
    
    // ============ MAIN EXECUTION INTERFACE ============
    
    execute(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🔥 Executing event: ${event.type}`);
        
        try {
            switch (event.type) {
                case EventType.CREATE_GAME:
                    return this.executeStartGame(event, gameEnv);
                    
                case EventType.JOIN_GAME:
                    return this.executeJoinGame(event, gameEnv);
                    
                case EventType.CONFIRM_REDRAW:
                    return this.executeStartReady(event, gameEnv);
                    
                case EventType.GAMEPLAY_BEGINS:
                    return this.executeGameStart(event, gameEnv);
                    
                case EventType.CARD_PLAYED:
                    return this.executeCardPlayed(event, gameEnv);
                    
                case EventType.ERROR_OCCURRED:
                    return this.executeErrorEvent(event, gameEnv);
                    
                case EventType.ACKNOWLEDGE_EVENTS:
                    return this.executeAcknowledgeEvents(event, gameEnv);
                    
                case EventType.PHASE_ADVANCE:
                    return this.executePhaseAdvance(event, gameEnv);
                    
                case EventType.END_TURN:
                    return this.executeEndTurn(event, gameEnv);
                    
                case EventType.CARDS_UNREST:
                    return this.executeCardsUnrest(event, gameEnv);
                    
                case EventType.NEXT_PLAYER_TURN:
                    return this.executeNextPlayerTurn(event, gameEnv);
                    
                case EventType.PLAYER_ACTION:
                    return this.executePlayerAction(event, gameEnv);
                    
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
    
    private executeStartGame(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
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
    
    private executeJoinGame(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, gameId } = event.data;
        
        console.log(`🎯 Processing JOIN_GAME event for player: ${playerId}`);
        
        try {
            // Add second player and update phase (moved from GameLogic.joinGame)
            gameEnv.playerId_2 = playerId;
            gameEnv.phase = GamePhase.REDRAW_PHASE;
            gameEnv.gameStarted = true;
            gameEnv.playersReady[playerId] = true;
            
            // Load deck configuration and set up game
            this.initializeGameWithDecks(gameEnv, playerId);
            
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
    
    private executeStartReady(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
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
                    player.deck.mainDeck = this.shuffleDeck(player.deck.mainDeck);
                    console.log(`🔀 Shuffled deck with ${player.deck.mainDeck.length} cards`);
                    
                    // Assign new 5 hand to player
                    this.drawCards(player.deck, 5);
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

            const notificationManager = this.getNotificationManager(gameEnv);
            
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
    
    private executeCardPlayed(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { cardId, cardUid, zone, playerId, isFaceDown } = event.data;
        
        console.log(`🎯 Processing CARD_PLAYED event: ${cardId} → ${zone} (${playerId})`);
        
        try {
            // TODO: Integrate with your existing card placement logic
            // This should call your existing game logic to actually place the card
            
            console.log(`✅ CARD_PLAYED event processed - ${cardId} placed in ${zone}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeCardPlayed:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'CARD_PLAYED execution failed'
            };
        }
    }
    
    private executeErrorEvent(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { errorReason, errorType, originalEventType, playerId } = event.data;
        
        console.log(`💥 Processing error: ${errorType} - ${errorReason}`);
        
        try {
            // Add error event using GameNotificationManager
            const notificationManager = this.getNotificationManager(gameEnv);
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
    
    private executeAcknowledgeEvents(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { eventIds, playerId } = event.data;
        
        console.log(`🎯 Processing ACKNOWLEDGE_EVENTS for ${eventIds.length} events`);
        
        try {
            // Create notification manager and acknowledge events
            const notificationManager = this.getNotificationManager(gameEnv);
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
    
    private executePhaseAdvance(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { actionId, description, affectedPlayers } = event.data;
        
        console.log(`🎯 Processing PHASE_ADVANCE event: ${description}`);
        
        try {
            // Handle specific phase advance actions
            if (actionId && actionId.startsWith('draw_to_main_')) {
                console.log(`🔄 Auto-advancing from DRAW_PHASE to MAIN_PHASE`);
                
                // Change phase directly
                gameEnv.phase = GamePhase.MAIN_PHASE;
                
                // Create phase change event for frontend notification
                const notificationManager = this.getNotificationManager(gameEnv);
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
    
    private initializeGameWithDecks(gameEnv: GameEnvironment, joinedPlayerId: string): void {
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
            const uniqueDeck1Cards = deck1Cards.map((cardId: string) => this.createUniqueCardId(cardId));
            const uniqueDeck2Cards = deck2Cards.map((cardId: string) => this.createUniqueCardId(cardId));
            
            // Create and shuffle decks with unique card instances
            const shuffledDeck1 = this.shuffleDeck([...uniqueDeck1Cards]);
            const shuffledDeck2 = this.shuffleDeck([...uniqueDeck2Cards]);
            
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
            this.drawCards(gameEnv.players[playerId1].deck, 5);
            this.drawCards(gameEnv.players[playerId2].deck, 5);
            
            console.log(`🎯 Game initialized: First player is ${gameEnv.currentPlayer}, hands drawn, redraw available`);
            
        } catch (error) {
            console.error('❌ Error initializing game with decks:', error);
            throw error;
        }
    }
    
    private shuffleDeck(cards: string[]): string[] {
        const shuffled = [...cards];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    private executeGameStart(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
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
                this.drawCards(firstPlayer.deck, 1);
                console.log(`🃏 Drew 1 card for first player ${firstPlayerId}`);
            }
            
            // Create game events using GameNotificationManager
            const notificationManager = this.getNotificationManager(gameEnv);
            
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
    
    private drawCards(deck: any, count: number): void {
        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (drawnCard) {
                deck._handUids.push(drawnCard);
            }
        }
        console.log(`🃏 Drew ${count} cards, hand size: ${deck._handUids.length}`);
    }
    
    // ============ END TURN SYSTEM ============
    
    private executeEndTurn(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, currentTurnNumber } = event.data;
        
        console.log(`🏁 Processing END_TURN event for player: ${playerId}, turn: ${currentTurnNumber}`);
        
        try {
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
    
    private executeCardsUnrest(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId } = event.data;
        
        console.log(`♻️ Processing CARDS_UNREST event for player: ${playerId}`);
        
        try {
            const player = gameEnv.players[playerId];
            if (!player) {
                return { success: false, error: 'Player not found' };
            }
            
            const affectedCards: string[] = [];
            
            // Unrest all energy cards
            if (player.zones?.energyArea) {
                player.zones.energyArea.forEach(energyCard => {
                    if (energyCard.isRested) {
                        energyCard.isRested = false;
                        affectedCards.push(energyCard.cardUid);
                    }
                });
            }
            
            // Unrest all unit cards in slots
            const slotZones = [player.zones.slot1, player.zones.slot2, player.zones.slot3, 
                              player.zones.slot4, player.zones.slot5, player.zones.slot6];
            
            slotZones.forEach(slot => {
                if (slot?.unit?.isRested) {
                    slot.unit.isRested = false;
                    affectedCards.push(slot.unit.cardUid);
                }
            });
            
            // Unrest base cards (if they have rested status)
            if (player.zones?.base) {
                player.zones.base.forEach(baseCard => {
                    if (baseCard.isRested) {
                        baseCard.isRested = false;
                        affectedCards.push(baseCard.cardUid);
                    }
                });
            }
            
            console.log(`♻️ Unrested ${affectedCards.length} cards for player ${playerId}`);
            
            // Create notification event
            const notificationManager = this.getNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'CARDS_UNRESTED',
                {
                    playerId: playerId,
                    affectedCards: affectedCards,
                    cardCount: affectedCards.length
                },
                false, // requiresAcknowledgment
                'normal' // priority
            );
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeCardsUnrest:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'CARDS_UNREST execution failed'
            };
        }
    }
    
    private executeNextPlayerTurn(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { currentPlayer, nextPlayer, currentTurn } = event.data;
        console.log("current event in nextplayer 111", JSON.stringify(event))
        console.log(`🔄 Processing NEXT_PLAYER_TURN event: ${currentPlayer} → ${nextPlayer}, turn: ${currentTurn} → ${currentTurn + 1}`);
        
        try {
            // Update game state for next player
            gameEnv.currentPlayer = nextPlayer;
            gameEnv.currentTurn = currentTurn + 1;
            gameEnv.phase = GamePhase.DRAW_PHASE;
            
            // Unrest current player's cards (via EnergyManager)
            const unrestResult = EnergyManager.untapAllEnergy(gameEnv, nextPlayer);
            
            // Add 1 more energy to current player
            const addEnergyResult = EnergyManager.addBasicEnergy(gameEnv, nextPlayer);
            
            console.log(`✅ Next player turn: ${currentPlayer} → ${nextPlayer}, turn: ${currentTurn} → ${currentTurn + 1}`);
            console.log(`✅ Energy untapped: ${unrestResult} and energy added: ${addEnergyResult}`);
                        // Draw 1 card from deck to first player hand
            const firstPlayer = gameEnv.players[nextPlayer];
            if (firstPlayer && firstPlayer.deck) {
                this.drawCards(firstPlayer.deck, 1);
                console.log(`🃏 Drew 1 card for first player ${nextPlayer}`);
            }
            
            // Create game events using GameNotificationManager
            const notificationManager = this.getNotificationManager(gameEnv);
            
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
    
    private executePlayerAction(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, cardUID } = event.data;
        
        console.log(`🎯 Processing PLAYER_ACTION event for player: ${playerId}, cardUID: ${cardUID}`);
        
        try {
            // Validate it's the player's turn
            if (gameEnv.currentPlayer !== playerId) {
                return {
                    success: false,
                    error: `Not your turn. Current player: ${gameEnv.currentPlayer}`
                };
            }
            
            // Find card in player's hand
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.deck?.hand) {
                return {
                    success: false,
                    error: `Player ${playerId} or hand not found`
                };
            }
            
            // Find card in hand
            const handCardIndex = player.deck.hand.findIndex(handCard => handCard.cardUid === cardUID);
            if (handCardIndex === -1) {
                return {
                    success: false,
                    error: `Card ${cardUID} not found in player ${playerId} hand`
                };
            }
            
            // TODO: Check if card is unit type (placeholder for now)
            const handCard = player.deck.hand[handCardIndex];
            const cardId = handCard.cardId;
            console.log(`🎯 Card ${cardUID} found in hand as cardId: ${cardId}`);
            
            // TODO: Validate card type is unit (placeholder)
            console.log(`🚧 [PLACEHOLDER] Card type validation - assuming unit type`);
            
            const playerZones = player.zones;
            const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
            
            // Find first empty UNIT slot only
            let targetZone = null;
            
            for (const zone of slotZones) {
                const slotZone = playerZones[zone];
                if (slotZone && !slotZone.unit) {
                    targetZone = zone;
                    break;
                }
            }
            
            if (!targetZone) {
                return {
                    success: false,
                    error: `No empty unit slots available in zones slot1-slot6`
                };
            }
            
            console.log(`✅ Found empty unit slot in ${targetZone} for card ${cardUID}`);
            
            // Remove card from hand
            player.deck.hand.splice(handCardIndex, 1);
            console.log(`🎮 Removed card ${cardUID} from hand`);
            
            // Create unit card for slot placement
            const unitCard = {
                cardUid: cardUID,
                cardId: cardId,
                placedAt: Date.now(),
                placedBy: playerId,
                isRested: false,
                cardData: {
                    // TODO: Load actual card data from card database
                    cardType: 'unit' as const // Fix TypeScript literal type
                }
            };
            
            // Place unit in target slot
            playerZones[targetZone].unit = unitCard;
            console.log(`🎮 Placed unit card ${cardUID} in ${targetZone}`);
            
            // TODO: Add effect processing and type compatibility validation
            console.log(`🚧 [PLACEHOLDER] Card effects and compatibility validation needed`);
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executePlayerAction:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'PLAYER_ACTION execution failed'
            };
        }
    }
    
    private queueEndTurnSequence(gameEnv: GameEnvironment, currentPlayerId: string, nextPlayerId: string, currentTurnNumber: number, currentEventManager: any): void {
        console.log(`📋 Queueing end turn sequence: ${currentPlayerId} → ${nextPlayerId}`);
        
        // Use the current EventManager that's processing this event
        const validEventManager = currentEventManager;
        
        // Import EventFactory
        const { EventFactory } = require('./EventQueue/interfaces/GameEvent');
        
        // 1. Turn Change Event
        const turnChangeEvent = EventFactory.createTurnStartEvent(
            nextPlayerId, 
            currentTurnNumber + 1, 
            GamePhase.DRAW_PHASE
        );
        validEventManager.enqueue(turnChangeEvent);
        
        // 2. Cards Unrest Event (for new current player)
        const cardsUnrestEvent = EventFactory.createCardsUnrestEvent(nextPlayerId, []);
        validEventManager.enqueue(cardsUnrestEvent);
        
        // 3. Energy Gained Event (add 1 energy to new current player)
        const energyGainedEvent = {
            id: `energy_gain_${Date.now()}_${Math.random()}`,
            type: EventType.RESOURCE_GAINED,
            status: 'DECLARED' as any,
            priority: 2, // EventPriority.NORMAL
            timestamp: Date.now(),
            playerId: nextPlayerId,
            data: {
                playerId: nextPlayerId,
                resourceType: 'energy',
                amount: 1
            }
        };
        validEventManager.enqueue(energyGainedEvent);
        
        // 4. Phase Advance Event (move to DRAW_PHASE)
        const phaseAdvanceEvent = EventFactory.createPhaseChangeEvent(
            gameEnv.phase,
            GamePhase.DRAW_PHASE,
            'Turn advance - end turn sequence'
        );
        validEventManager.enqueue(phaseAdvanceEvent);
        
        console.log(`✅ Queued 4 end turn events for processing`);
    }
}