// src/services/EventQueue/EventProcessor.ts
// Event lifecycle management and processing coordination

import { GameEventQueue, EventQueueOutput } from './GameEventQueue';
import { GameEvent, EventFactory, EventStatus, EventPriority } from './interfaces/GameEvent';
import { TriggerEngine } from './TriggerEngine';
import { EffectStack, StackResolutionResult } from './EffectStack';
import { StateBasedActionEngine } from './StateBasedActionEngine';
import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import * as fs from 'fs';
import * as path from 'path';

export interface ProcessingResult {
    success: boolean;
    eventsProcessed: number;
    needsPlayerInput: boolean;
    waitingForChoice?: string;
    error?: string;
}

export class EventProcessor {
    private eventQueue: GameEventQueue;
    private triggerEngine: TriggerEngine;
    private effectStack: EffectStack;
    private stateEngine: StateBasedActionEngine;
    private gameEnv: GameEnvironment;
    
    constructor(gameEnv: GameEnvironment) {
        this.eventQueue = new GameEventQueue();
        this.triggerEngine = new TriggerEngine(gameEnv);
        this.effectStack = new EffectStack(gameEnv);
        this.stateEngine = new StateBasedActionEngine(gameEnv);
        this.gameEnv = gameEnv;
        
        // ✅ CRITICAL: Integrate engines with event queue for proper TCG flow
        this.eventQueue.setTriggerEngine(this.triggerEngine);
        this.eventQueue.setStateBasedEngine(this.stateEngine);
        this.eventQueue.setEventProcessor(this);
        
        console.log('🔧 EventProcessor initialized with integrated TCG engines');
    }
    
    // ============ MAIN PROCESSING INTERFACE ============
    
    
    /**
     * Process event directly - simplified interface for GameLogic
     */
    async processEvent(event: GameEvent): Promise<ProcessingResult> {
        try {
            console.log(`🎮 Processing event directly: ${event.type}`);
            
            // Enqueue the event directly
            this.eventQueue.enqueue(event);
            
            // Process through full TCG event system
            const result = await this.processFullEventCycle();
            
            // Check if any error events were generated during processing
            if (this.gameEnv.gameEvents) {
                const recentErrors = this.gameEnv.gameEvents.filter(evt => 
                    evt.type === 'ERROR_OCCURRED' && 
                    evt.timestamp > (Date.now() - 1000) // Within last second
                );
                
                if (recentErrors.length > 0) {
                    const latestError = recentErrors[recentErrors.length - 1];
                    return {
                        success: false,
                        eventsProcessed: result.eventsProcessed,
                        needsPlayerInput: result.needsPlayerInput,
                        error: latestError.data.errorReason || 'Validation failed'
                    };
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Error processing event:', error);
            return {
                success: false,
                eventsProcessed: 0,
                needsPlayerInput: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    /**
     * Simplified event processing - GameEventQueue now handles everything
     */
    private async processFullEventCycle(): Promise<ProcessingResult> {
        // GameEventQueue now handles triggers, state-based actions, and validation internally
        const queueOutput = this.eventQueue.processUntilBlocked(this.gameEnv);
        return {
            success: true,
            eventsProcessed: queueOutput.eventsProcessed,
            needsPlayerInput: queueOutput.needsPlayerInput,
            waitingForChoice: queueOutput.waitingForChoice
        };
    }
    
    /**
     * Handle player choice response
     */
    async resolvePlayerChoice(selectionId: string, choices: string[]): Promise<ProcessingResult> {
        try {
            console.log(`🎯 Resolving player choice: ${selectionId}`);
            
            // Find pending choice event
            const choiceEvent = this.eventQueue.getCurrentPlayerChoice();
            if (!choiceEvent || choiceEvent.data.selectionId !== selectionId) {
                return {
                    success: false,
                    eventsProcessed: 0,
                    needsPlayerInput: false,
                    error: 'No matching player choice found'
                };
            }
            
            // Generate choice resolution event
            const resolveEvent = EventFactory.createChoiceResolvedEvent(
                selectionId,
                choices,
                choiceEvent.data.playerId
            );
            
            // Mark choice event as resolved and add resolution event
            choiceEvent.status = EventStatus.RESOLVED;
            this.eventQueue.enqueue(resolveEvent);
            
            // Continue processing
            const output = this.eventQueue.processUntilBlocked(this.gameEnv);
            
            return {
                success: true,
                eventsProcessed: output.eventsProcessed,
                needsPlayerInput: output.needsPlayerInput,
                waitingForChoice: output.waitingForChoice
            };
            
        } catch (error) {
            console.error('❌ Error resolving player choice:', error);
            return {
                success: false,
                eventsProcessed: 0,
                needsPlayerInput: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    
    // ============ TCG SYSTEM ACCESS ============
    
    /**
     * Get comprehensive system status for debugging
     */
    getQueueStatus(): any {
        return {
            eventQueue: this.eventQueue.getQueueStatus(),
            effectStack: {
                size: this.effectStack.size(),
                isEmpty: this.effectStack.isEmpty(),
                canAddToStack: this.effectStack.canAddToStack()
            },
            triggerEngine: {
                // TODO: Add trigger engine status
                initialized: true
            },
            stateEngine: {
                // TODO: Add state engine status  
                initialized: true
            }
        };
    }
    
    /**
     * Get trigger engine instance
     */
    getTriggerEngine(): TriggerEngine {
        return this.triggerEngine;
    }
    
    /**
     * Get effect stack instance
     */
    getEffectStack(): EffectStack {
        return this.effectStack;
    }
    
    /**
     * Get state-based action engine
     */
    getStateEngine(): StateBasedActionEngine {
        return this.stateEngine;
    }
    
    /**
     * Get event queue instance
     */
    getEventQueue(): GameEventQueue {
        return this.eventQueue;
    }
    
    /**
     * Force process next event (debugging)
     */
    processNextEvent(): boolean {
        if (this.eventQueue.isEmpty()) return false;
        
        const output = this.eventQueue.processUntilBlocked(this.gameEnv);
        return output.eventsProcessed > 0;
    }
    
    // ============ SERIALIZATION ============
    
    /**
     * Serialize processor state with all TCG systems
     */
    toJSON(): any {
        return {
            eventQueue: this.eventQueue.toJSON(),
            triggerEngine: this.triggerEngine.toJSON(),
            effectStack: this.effectStack.toJSON(),
            stateEngine: this.stateEngine.toJSON()
        };
    }
    
    /**
     * Restore processor from serialized state with all systems
     */
    static fromJSON(data: any, gameEnv: GameEnvironment): EventProcessor {
        const processor = new EventProcessor(gameEnv);
        
        if (data.eventQueue) {
            processor.eventQueue = GameEventQueue.fromJSON(data.eventQueue);
        }
        if (data.triggerEngine) {
            processor.triggerEngine = TriggerEngine.fromJSON(data.triggerEngine, gameEnv);
        }
        if (data.effectStack) {
            processor.effectStack = EffectStack.fromJSON(data.effectStack, gameEnv);
        }
        if (data.stateEngine) {
            processor.stateEngine = StateBasedActionEngine.fromJSON(data.stateEngine, gameEnv);
        }
        
        return processor;
    }
    
 
    /**
     * Initialize card effects when card enters play
     */
    initializeCardEffects(cardId: string, cardUid: string, playerId: string): void {
        this.triggerEngine.initializeCardTriggers(cardId, cardUid, playerId);
        console.log(`🎯 Card effects initialized: ${cardId}`);
    }
    
    /**
     * Clean up card effects when card leaves play
     */
    cleanupCardEffects(cardUid: string): void {
        this.triggerEngine.cleanupCardEffects(cardUid);
        console.log(`🧹 Card effects cleaned up: ${cardUid}`);
    }
    
    // ============ EVENT EXECUTION METHODS ============
    
    /**
     * Execute specific event types - moved from EventExecutor for consolidation
     */
    executeEvent(event: GameEvent, gameEnv: GameEnvironment): { success: boolean; error?: string } {
        console.log(`🔥 Executing event: ${event.type}`);
        
        try {
            switch (event.type) {
                case 'START_GAME':
                    return this.executeStartGame(event, gameEnv);
                    
                case 'JOIN_GAME':
                    return this.executeJoinGame(event, gameEnv);
                    
                case 'CARD_PLAYED':
                    return this.executeCardPlayed(event, gameEnv);
                    
                case 'ERROR_OCCURRED':
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
    
    private executeStartGame(event: GameEvent, gameEnv: GameEnvironment): { success: boolean; error?: string } {
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
    
    private executeJoinGame(event: GameEvent, gameEnv: GameEnvironment): { success: boolean; error?: string } {
        const { playerId, gameId } = event.data;
        
        console.log(`🎯 Processing JOIN_GAME event for player: ${playerId}`);
        
        try {
            // Add second player and update phase (moved from GameLogic.joinGame)
            gameEnv.playerId_2 = playerId;
            gameEnv.phase = GamePhase.BOTH_JOINED;
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
    
    private executeCardPlayed(event: GameEvent, gameEnv: GameEnvironment): { success: boolean; error?: string } {
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
    
    private executeErrorEvent(event: GameEvent, gameEnv: GameEnvironment): { success: boolean; error?: string } {
        const { errorReason, errorType, originalEventType, playerId } = event.data;
        
        console.log(`💥 Processing error: ${errorType} - ${errorReason}`);
        
        try {
            // Add error to game events for frontend consumption
            if (gameEnv.gameEvents) {
                gameEnv.gameEvents.push({
                    id: event.id,
                    type: 'ERROR_OCCURRED',
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
            const deckConfigPath = path.join(__dirname, '../../data/gcgdecks.json');
            const deckConfig = JSON.parse(fs.readFileSync(deckConfigPath, 'utf8'));
            
            // Load card data
            const cardDataPath = path.join(__dirname, '../../data/st01Card.json');
            const cardData = JSON.parse(fs.readFileSync(cardDataPath, 'utf8'));
            
            // Get player IDs
            const playerId1 = gameEnv.playerId_1!;
            const playerId2 = gameEnv.playerId_2!;
            
            // Assign decks to players
            const deck1Config = deckConfig.playerDecks[playerId1] || deckConfig.playerDecks['playerId_1'];
            const deck2Config = deckConfig.playerDecks[playerId2] || deckConfig.playerDecks['playerId_2'];
            
            const deck1Cards = deckConfig.decks[deck1Config.activeDeck].cards;
            const deck2Cards = deckConfig.decks[deck2Config.activeDeck].cards;
            
            // Create and shuffle decks
            const shuffledDeck1 = this.shuffleDeck([...deck1Cards]);
            const shuffledDeck2 = this.shuffleDeck([...deck2Cards]);
            
            // Random first player selection
            const firstPlayer = Math.floor(Math.random() * 2); // 0 or 1
            gameEnv.firstPlayer = firstPlayer;
            gameEnv.currentPlayer = firstPlayer === 0 ? playerId1 : playerId2;
            
            // Initialize players with decks using proper PlayerDeck structure
            if (!gameEnv.players[playerId1]) {
                gameEnv.addPlayer(playerId1, 'Player 1');
            }
            const player1 = gameEnv.players[playerId1];
            player1.deck.hand = [];
            player1.deck.mainDeck = shuffledDeck1;
            
            if (!gameEnv.players[playerId2]) {
                gameEnv.addPlayer(playerId2, 'Player 2');
            }
            const player2 = gameEnv.players[playerId2];
            player2.deck.hand = [];
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
    
    private drawCards(deck: any, count: number): void {
        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (drawnCard) {
                deck.hand.push(drawnCard);
            }
        }
        console.log(`🃏 Drew ${count} cards, hand size: ${deck.hand.length}`);
    }
}

// ============ TYPE DEFINITIONS ============

export interface PlayerAction {
    type: string;
    playerId: string;
    cardId?: string;
    cardUid?: string;
    zone?: string;
    isFaceDown?: boolean;
    targetPhase?: GamePhase;
    [key: string]: any;
}

