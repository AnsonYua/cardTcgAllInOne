// src/services/GameEngine.ts
// Game execution engine - handles all game state modifications

import { GameEvent } from './EventQueue/interfaces/GameEvent';
import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase, EventType } from '../models/GameEnums';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionResult {
    success: boolean;
    error?: string;
}

export class GameEngine {
    private static cardDatabase: any = null;
    
    constructor() {
        console.log('🎯 GameEngine initialized');
        this.loadCardDatabase();
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
                case EventType.START_GAME:
                    return this.executeStartGame(event, gameEnv);
                    
                case EventType.JOIN_GAME:
                    return this.executeJoinGame(event, gameEnv);
                    
                case EventType.START_READY:
                    return this.executeStartReady(event, gameEnv);
                    
                case EventType.GAME_START:
                    return this.executeGameStart(event, gameEnv);
                    
                case EventType.CARD_PLAYED:
                    return this.executeCardPlayed(event, gameEnv);
                    
                case EventType.ERROR_OCCURRED:
                    return this.executeErrorEvent(event, gameEnv);
                    
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
        
        console.log(`🎯 Processing START_GAME event for player: ${playerId}`);
        
        try {
            // Initialize basic game state (moved from GameLogic.createGame)
            gameEnv.playerId_1 = playerId;
            gameEnv.phase = GamePhase.WAITING_FOR_PLAYERS;
            gameEnv.gameStarted = false;
            gameEnv.playersReady = gameEnv.playersReady || {};
            gameEnv.playersReady[playerId] = true;
            
            console.log(`✅ START_GAME event processed - game state initialized for ${playerId}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeStartGame:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'START_GAME execution failed'
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
        
        console.log(`🎯 Processing START_READY event for player: ${playerId}, isRedraw: ${isRedraw}`);
        
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
            
            // Mark player as ready and set confirmIsRedraw
            gameEnv.playersReady[playerId] = true;
            
            const player = gameEnv.players[playerId];
            if (player) {
                player.confirmIsRedraw = isRedraw || false;
                console.log(`✅ Player ${playerId} confirmIsRedraw set to: ${player.confirmIsRedraw}`);
            }

            // Note: GAME_START will be triggered automatically by StateBasedActionEngine
            // when it detects both players are ready and confirmed
            
            console.log(`✅ START_READY event processed - player ${playerId} marked as ready (redraw: ${isRedraw})`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeStartReady:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'START_READY execution failed'
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
            // Add error to game events for frontend consumption
            if (gameEnv.gameEvents) {
                gameEnv.gameEvents.push({
                    id: event.id,
                    type: EventType.ERROR_OCCURRED,
                    data: {
                        errorType,
                        errorReason,
                        originalEventType,
                        playerId
                    },
                    timestamp: event.timestamp,
                    expiresAt: event.timestamp + 3000, // 3 second expiration
                    frontendProcessed: false
                });
            }
            
            console.log(`📨 Error event added to gameEvents for frontend: ${errorReason}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeErrorEvent:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'ERROR_OCCURRED execution failed'
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
            const firstPlayer = Math.floor(Math.random() * 2); // 0 or 1
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
            
            // Add 1 basic resource to first player
            const firstPlayer = gameEnv.players[firstPlayerId];
            if (firstPlayer && firstPlayer.zones) {
                const basicEnergyCard = {
                    cardUid: `energy_basic_${Date.now()}_${Math.random()}`,
                    cardId: 'energy_basic',
                    cardData: {
                        id: 'energy_basic',
                        name: 'Basic Energy',
                        cardType: 'energy' as const,
                        color: 'neutral',
                        level: 1,
                        cost: 0,
                        zone: ['energy'],
                        traits: [],
                        link: [],
                        ap: 0,
                        hp: 0,
                        effects: { description: [], rules: [] },
                        energyType: 'permanent' as const,
                        energyValue: 1
                    },
                    placedAt: Date.now(),
                    placedBy: firstPlayerId,
                    isRested: false,
                    isExtraEnergy: false,
                    energyValue: 1
                };
                
                firstPlayer.zones.energyArea.push(basicEnergyCard);
                console.log(`⚡ Added basic energy to first player ${firstPlayerId}`);
            }
            
            // Add 1 extra resource (isExtraEnergy=true) to second player
            const secondPlayer = gameEnv.players[secondPlayerId];
            if (secondPlayer && secondPlayer.zones) {
                const extraEnergyCard = {
                    cardUid: `energy_extra_${Date.now()}_${Math.random()}`,
                    cardId: 'energy_extra',
                    cardData: {
                        id: 'energy_extra',
                        name: 'Extra Energy',
                        cardType: 'energy' as const,
                        color: 'neutral',
                        level: 1,
                        cost: 0,
                        zone: ['energy'],
                        traits: [],
                        link: [],
                        ap: 0,
                        hp: 0,
                        effects: { description: [], rules: [] },
                        energyType: 'permanent' as const,
                        energyValue: 1
                    },
                    placedAt: Date.now(),
                    placedBy: secondPlayerId,
                    isRested: false,
                    isExtraEnergy: true,
                    energyValue: 1
                };
                
                secondPlayer.zones.energyArea.push(extraEnergyCard);
                console.log(`⚡ Added extra energy to second player ${secondPlayerId}`);
            }
            
            // Advance to MAIN_PHASE
            gameEnv.phase = GamePhase.MAIN_PHASE;
            console.log(`📋 Advanced to MAIN_PHASE - game started`);
            
            console.log(`✅ GAME_START event processed - resources allocated and phase advanced`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error in executeGameStart:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'GAME_START execution failed'
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
}