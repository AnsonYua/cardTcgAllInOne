// src/services/EventQueue/EventManager.ts
// Unified event management system - combines queue operations and lifecycle processing

import { GameEvent, EventFactory, EventStatus, EventPriority } from './interfaces/GameEvent';
import { TriggerEngine } from './TriggerEngine';
import { EffectStack, StackResolutionResult } from './EffectStack';
import { StateBasedActionEngine } from './StateBasedActionEngine';
import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase, EventType } from '../../models/GameEnums';
import { GameEngine, ExecutionResult } from '../GameEngine';

export interface ProcessingResult {
    success: boolean;
    eventsProcessed: number;
    needsPlayerInput: boolean;
    waitingForChoice?: string;
    error?: string;
}

export interface EventQueueOutput {
    hasEvents: boolean;
    needsPlayerInput: boolean;
    eventsProcessed: number;
    waitingForChoice?: string;
}

export interface PlayerAction {
    type: string;
    playerId: string;
    cardId?: string;
    cardUid?: string;
    zone?: string;
    targetPhase?: GamePhase;
    [key: string]: any;
}

export class EventManager {
    // Queue state
    private events: GameEvent[] = [];
    private processingEnabled: boolean = true;
    private maxEventsPerCycle: number = 50;
    
    // TCG Engine integrations
    private triggerEngine: TriggerEngine;
    private effectStack: EffectStack;
    private stateEngine: StateBasedActionEngine;
    private gameEngine: GameEngine;
    private gameEnv: GameEnvironment;
    
    constructor(gameEnv: GameEnvironment) {
        this.gameEnv = gameEnv;
        this.triggerEngine = new TriggerEngine(gameEnv);
        this.effectStack = new EffectStack(gameEnv);
        this.stateEngine = new StateBasedActionEngine(gameEnv);
        this.gameEngine = new GameEngine();
        
        // Integration setup
        this.setupEngineIntegration();
        
        console.log('🎮 EventManager initialized with unified event processing');
    }
    
    private setupEngineIntegration(): void {
        // Note: TriggerEngine and StateBasedEngine integration methods 
        // would need to be updated to work directly with EventManager
        console.log('🔗 TCG engines integrated with unified EventManager');
    }
    
    // ============ MAIN PROCESSING INTERFACE ============
    
    /**
     * Process event directly - unified interface for GameLogic
     */
    async processEvent(event: GameEvent): Promise<ProcessingResult> {
        try {
            console.log(`🎮 Processing event directly: ${event.type}`);
            
            // Enqueue the event directly
            this.enqueue(event);
            
            // Process through full TCG event system
            const result = await this.processFullEventCycle();
            
            // Check if any error events were generated during processing
            if (this.gameEnv.gameEvents) {
                const recentErrors = this.gameEnv.gameEvents.filter(evt => 
                    evt.type === EventType.ERROR_OCCURRED && 
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
     * Unified event processing - handles both queue and processing logic
     */
    private async processFullEventCycle(): Promise<ProcessingResult> {
        const queueOutput = this.processUntilBlocked(this.gameEnv);
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
            const choiceEvent = this.getCurrentPlayerChoice();
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
            this.enqueue(resolveEvent);
            
            // Continue processing
            const output = this.processUntilBlocked(this.gameEnv);
            
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
    
    // ============ QUEUE MANAGEMENT ============
    
    enqueue(event: GameEvent): void {
        this.events.push(event);
        
        this.events.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // Higher priority numbers go first
            }
            return a.timestamp - b.timestamp; // Earlier timestamps go first within same priority
        });
        
        console.log(`📋 Event queued: ${event.type} (priority: ${event.priority})`);
    }
    
    peek(): GameEvent | null {
        return this.events.length > 0 ? this.events[0] : null;
    }
    
    dequeue(): GameEvent | null {
        const event = this.events.shift();
        if (event) {
            console.log(`📤 Event dequeued: ${event.type}`);
        }
        return event || null;
    }
    
    isEmpty(): boolean {
        return this.events.length === 0;
    }
    
    size(): number {
        return this.events.length;
    }
    
    clear(): void {
        this.events = [];
        console.log('🧹 Event queue cleared');
    }
    
    // ============ PROCESSING CONTROL ============
    
    setProcessingEnabled(enabled: boolean): void {
        this.processingEnabled = enabled;
        console.log(`🎛️ Event processing ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    isProcessingEnabled(): boolean {
        return this.processingEnabled;
    }
    
    needsPlayerInput(): boolean {
        const nextEvent = this.peek();
        return nextEvent?.type === EventType.PLAYER_CHOICE_REQUIRED && 
               nextEvent?.status === EventStatus.DECLARED;
    }
    
    getCurrentPlayerChoice(): GameEvent | null {
        const nextEvent = this.peek();
        if (nextEvent?.type === EventType.PLAYER_CHOICE_REQUIRED && 
            nextEvent?.status === EventStatus.DECLARED) {
            return nextEvent;
        }
        return null;
    }
    
    // ============ BATCH PROCESSING ============
    
    processUntilBlocked(gameEnv: GameEnvironment): EventQueueOutput {
        let eventsProcessed = 0;
        let hasEvents = !this.isEmpty();
        
        while (this.processingEnabled && 
               !this.isEmpty() && 
               !this.needsPlayerInput() && 
               eventsProcessed < this.maxEventsPerCycle) {
            
            const event = this.peek();
            if (!event) break;
            
            console.log(`⚡ Processing event: ${event.type} (${event.status})`);
            
            if (event.status === EventStatus.DECLARED) {
                // ============ DECLARED PHASE LOGIC ============
                console.log(`📋 Event declared: ${event.type} - checking for reactions`);
                
                // 1. VALIDATION: Check if event can execute
                const validationResult = this.validateEventExecution(event, gameEnv);
                if (!validationResult.isValid) {
                    console.log(`❌ Event ${event.type} failed validation: ${validationResult.reason}`);
                    
                    // Create error event instead of silent failure
                    const errorEvent = this.createValidationErrorEvent(event, validationResult.reason || 'Unknown validation error');
                    this.replaceEvent(event, errorEvent);
                    continue;
                }
                
                // 2. TRIGGER CHECK: Find reactive abilities that trigger on declaration
                const reactions = this.findTriggeredReactions(event, gameEnv);
                reactions.forEach(reaction => {
                    console.log(`🔗 Adding triggered reaction: ${reaction.type}`);
                    this.enqueue(reaction);
                });
                
                // 3. REPLACEMENT CHECK: Can this event be replaced?
                const replacement = this.checkForReplacementEffects(event, gameEnv);
                if (replacement) {
                    console.log(`🔄 Event ${event.type} replaced by ${replacement.type}`);
                    this.replaceEvent(event, replacement);
                    continue;
                }
                
                // 4. Ready to resolve
                event.status = EventStatus.RESOLVING;
                
            } else if (event.status === EventStatus.RESOLVING) {
                // ============ RESOLVING PHASE LOGIC ============
                console.log(`🔥 Executing event: ${event.type}`);
                const executionResult = this.gameEngine.execute(event, gameEnv);
                
                if (executionResult.success) {
                    event.status = EventStatus.RESOLVED;
                } else {
                    console.error(`❌ Event execution failed: ${executionResult.error}`);
                    // Mark as resolved anyway to prevent infinite loop
                    event.status = EventStatus.RESOLVED;
                }
                
            } else if (event.status === EventStatus.RESOLVED) {
                // ============ RESOLVED PHASE LOGIC ============
                console.log(`✅ Event resolved: ${event.type}`);
                
                // Check for state-based actions after resolution
                const stateActions = this.checkForStateBasedActions(gameEnv);
                stateActions.forEach(stateEvent => {
                    console.log(`🏛️ Adding state-based action: ${stateEvent.type}`);
                    console.log("event :----", JSON.stringify(stateEvent))
                    this.enqueue(stateEvent);
                });
                
                this.dequeue();
                eventsProcessed++;
            }
        }
        
        const output: EventQueueOutput = {
            hasEvents: !this.isEmpty(),
            needsPlayerInput: this.needsPlayerInput(),
            eventsProcessed,
            waitingForChoice: this.getCurrentPlayerChoice()?.data?.selectionId
        };
        
        console.log(`📊 Queue processing complete: ${eventsProcessed} events processed`);
        return output;
    }
    
    // ============ EVENT VALIDATION ============
    
    private validateEventExecution(event: GameEvent, gameEnv: GameEnvironment): { isValid: boolean; reason?: string } {
        console.log(`🔍 Validating event: ${event.type}`);
        
        switch (event.type) {
            case EventType.JOIN_GAME:
                return this.validateJoinGameEvent(event, gameEnv);
                
            case EventType.CONFIRM_REDRAW:
                return this.validateStartReadyEvent(event, gameEnv);
                
            case EventType.PLAYER_CHOICE_REQUIRED:
                // Always valid - player choices are system-generated
                return { isValid: true };
                
            default:
                // Most events are valid by default
                return { isValid: true };
        }
    }
    
    
    private validateJoinGameEvent(event: GameEvent, gameEnv: GameEnvironment): { isValid: boolean; reason?: string } {
        console.log(`🔍 Validating JOIN_GAME event`);
        
        const { playerId } = event.data;
        
        // Check if room is available for joining
        if (gameEnv.phase !== GamePhase.WAITING_FOR_PLAYERS) {
            return {
                isValid: false,
                reason: 'Room is not available for joining'
            };
        }
        
        // Check if game is full
        if (gameEnv.playerId_2 && gameEnv.playerId_2 !== playerId) {
            return {
                isValid: false,
                reason: 'Game is full'
            };
        }
        
        return { isValid: true };
    }
    
    private validateStartReadyEvent(event: GameEvent, gameEnv: GameEnvironment): { isValid: boolean; reason?: string } {
        console.log(`🔍 Validating CONFIRM_REDRAW event`);
        
        const { playerId, isRedraw } = event.data;
        
        // Basic validation: Check if player exists in game
        if (playerId !== gameEnv.playerId_1 && playerId !== gameEnv.playerId_2) {
            return {
                isValid: false,
                reason: 'Player not found in game'
            };
        }
        
        // Validate redraw logic
        if (isRedraw !== undefined) {
            console.log(`🔄 CONFIRM_REDRAW with isRedraw: ${isRedraw} for player ${playerId}`);
            // TODO: Add custom redraw validation logic here
            // Examples:
            // - Check if player is eligible for redraw
            // - Validate redraw count limits
            // - Check game phase allows redraw
        }
        
        return { isValid: true };
    }
    
    private createValidationErrorEvent(originalEvent: GameEvent, reason: string): GameEvent {
        return {
            id: `error_${Date.now()}_${Math.random()}`,
            type: EventType.ERROR_OCCURRED,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH, // Errors have high priority
            timestamp: Date.now(),
            playerId: originalEvent.playerId,
            data: {
                originalEventType: originalEvent.type,
                originalEventId: originalEvent.id,
                errorReason: reason,
                errorType: EventType.VALIDATION_FAILED,
                playerId: originalEvent.playerId
            }
        };
    }
    
    private findTriggeredReactions(event: GameEvent, gameEnv: GameEnvironment): GameEvent[] {
        console.log(`🔍 Checking for triggered reactions to: ${event.type}`);
        return this.triggerEngine.checkTriggeredAbilities(event);
    }
    
    private checkForReplacementEffects(event: GameEvent, gameEnv: GameEnvironment): GameEvent | null {
        // TODO: Check for "instead" effects that replace this event
        // Example: "Instead of drawing a card, gain 1 energy"
        console.log(`🔄 Checking replacement effects for: ${event.type}`);
        return null; // No replacement effects for now
    }
    
    private replaceEvent(originalEvent: GameEvent, replacementEvent: GameEvent): void {
        // Remove original event and add replacement
        const index = this.events.indexOf(originalEvent);
        if (index !== -1) {
            this.events[index] = replacementEvent;
            console.log(`🔄 Event replaced: ${originalEvent.type} → ${replacementEvent.type}`);
        }
    }
    
    private checkForStateBasedActions(gameEnv: GameEnvironment): GameEvent[] {
        console.log('🏛️ Checking for state-based actions...');
        const stateActions = this.stateEngine.checkForStateBasedActions();
        
        // Convert state-based actions to events
        const stateEvents: GameEvent[] = [];
        stateActions.forEach(action => {
            if (action.autoExecute) {
                const stateEvent: GameEvent = {
                    id: `state_${Date.now()}_${Math.random()}`,
                    type: action.type,
                    status: EventStatus.DECLARED,
                    priority: EventPriority.HIGH, // State-based actions have high priority
                    timestamp: Date.now(),
                    data: {
                        actionId: action.actionId,
                        description: action.description,
                        affectedCards: action.affectedCards,
                        affectedPlayers: action.affectedPlayers
                    }
                };
                if (action.type == EventType.NEXT_PLAYER_TURN){
                    stateEvent.data.currentPlayer = action.data.currentPlayer;
                    stateEvent.data.nextPlayer = action.data.nextPlayer;
                    stateEvent.data.currentTurn = action.data.currentTurn;
                }
                stateEvents.push(stateEvent);
            }
        });
        
        return stateEvents;
    }
    
    // ============ TCG SYSTEM ACCESS ============
    
    /**
     * Get comprehensive system status for debugging
     */
    getSystemStatus(): any {
        return {
            eventQueue: {
                size: this.events.length,
                events: this.events.map(e => ({ 
                    type: e.type, 
                    status: e.status, 
                    priority: e.priority 
                })),
                needsInput: this.needsPlayerInput()
            },
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
     * Force process next event (debugging)
     */
    processNextEvent(): boolean {
        if (this.isEmpty()) return false;
        
        const output = this.processUntilBlocked(this.gameEnv);
        return output.eventsProcessed > 0;
    }
    
    // ============ EVENT-DRIVEN ACKNOWLEDGMENT ============
    
    /**
     * Create acknowledgment event and queue it for processing
     */
    createAcknowledgmentEvent(eventIds: string[], playerId: string): void {
        const acknowledgmentEvent: GameEvent = {
            id: `ack_${Date.now()}_${Math.random()}`,
            type: EventType.ACKNOWLEDGE_EVENTS,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            timestamp: Date.now(),
            playerId: playerId,
            data: {
                eventIds: eventIds,
                playerId: playerId
            }
        };
        
        console.log(`📨 Creating ACKNOWLEDGE_EVENTS event for ${eventIds.length} events`);
        this.enqueue(acknowledgmentEvent);
    }

    // ============ CARD EFFECT MANAGEMENT ============
    
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
    
    // ============ SERIALIZATION ============
    
    /**
     * Serialize manager state with all TCG systems
     */
    toJSON(): any {
        return {
            events: this.events,
            processingEnabled: this.processingEnabled,
            triggerEngine: this.triggerEngine.toJSON(),
            effectStack: this.effectStack.toJSON(),
            stateEngine: this.stateEngine.toJSON()
        };
    }
    
    /**
     * Restore manager from serialized state with all systems
     */
    static fromJSON(data: any, gameEnv: GameEnvironment): EventManager {
        const manager = new EventManager(gameEnv);
        
        manager.events = data.events || [];
        manager.processingEnabled = data.processingEnabled !== false;
        
        if (data.triggerEngine) {
            manager.triggerEngine = TriggerEngine.fromJSON(data.triggerEngine, gameEnv);
        }
        if (data.effectStack) {
            manager.effectStack = EffectStack.fromJSON(data.effectStack, gameEnv);
        }
        if (data.stateEngine) {
            manager.stateEngine = StateBasedActionEngine.fromJSON(data.stateEngine, gameEnv);
        }
        
        return manager;
    }
}

// ============ TYPE DEFINITIONS ============
// PlayerAction now exported at top of file