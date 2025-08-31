// src/services/EventQueue/GameEventQueue.ts
// Main event queue coordinator for trading card game

import { GameEvent, EventStatus, EventPriority, BaseGameEvent } from './interfaces/GameEvent';
import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { TriggerEngine } from './TriggerEngine';
import { StateBasedActionEngine } from './StateBasedActionEngine';

export interface EventQueueOutput {
    hasEvents: boolean;
    needsPlayerInput: boolean;
    eventsProcessed: number;
    waitingForChoice?: string;
}

export class GameEventQueue {
    private events: GameEvent[] = [];
    private processingEnabled: boolean = true;
    private maxEventsPerCycle: number = 50;
    private triggerEngine?: TriggerEngine;
    private stateBasedEngine?: StateBasedActionEngine;
    private eventProcessor?: any; // Reference to EventProcessor for execution delegation
    
    constructor() {
        console.log('🎮 GameEventQueue initialized');
    }
    
    // ============ ENGINE INTEGRATION ============
    
    setTriggerEngine(triggerEngine: TriggerEngine): void {
        this.triggerEngine = triggerEngine;
        console.log('🔗 TriggerEngine integrated with GameEventQueue');
    }
    
    setStateBasedEngine(stateBasedEngine: StateBasedActionEngine): void {
        this.stateBasedEngine = stateBasedEngine;
        console.log('🏛️ StateBasedActionEngine integrated with GameEventQueue');
    }
    
    setEventProcessor(eventProcessor: any): void {
        this.eventProcessor = eventProcessor;
        console.log('🔗 EventProcessor integrated with GameEventQueue');
    }
    
    // ============ QUEUE MANAGEMENT ============
    
    enqueue(event: GameEvent): void {
        this.events.push(event);
        
        this.events.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority; // ✅ FIXED: Higher priority numbers go first
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
        return nextEvent?.type === 'PLAYER_CHOICE_REQUIRED' && 
               nextEvent?.status === EventStatus.DECLARED;
    }
    
    getCurrentPlayerChoice(): GameEvent | null {
        const nextEvent = this.peek();
        if (nextEvent?.type === 'PLAYER_CHOICE_REQUIRED' && 
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
                if (this.eventProcessor) {
                    const executionResult = this.eventProcessor.executeEvent(event, gameEnv);
                    if (executionResult.success) {
                        event.status = EventStatus.RESOLVED;
                    } else {
                        console.error(`❌ Event execution failed: ${executionResult.error}`);
                        // Mark as resolved anyway to prevent infinite loop
                        event.status = EventStatus.RESOLVED;
                    }
                } else {
                    console.error('❌ EventProcessor not set - cannot execute event');
                    event.status = EventStatus.RESOLVED;
                }
                
            } else if (event.status === EventStatus.RESOLVED) {
                // ============ RESOLVED PHASE LOGIC ============
                console.log(`✅ Event resolved: ${event.type}`);
                
                // Check for state-based actions after resolution
                const stateActions = this.checkForStateBasedActions(gameEnv);
                stateActions.forEach(stateEvent => {
                    console.log(`🏛️ Adding state-based action: ${stateEvent.type}`);
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
    
    
    // ============ DECLARED PHASE METHODS ============
    
    private validateEventExecution(event: GameEvent, gameEnv: GameEnvironment): { isValid: boolean; reason?: string } {
        console.log(`🔍 Validating event: ${event.type}`);
        
        switch (event.type) {
            case 'JOIN_GAME':
                return this.validateJoinGameEvent(event, gameEnv);
                
            case 'CARD_PLAYED':
                return this.validateCardPlayedEvent(event, gameEnv);
                
            case 'PLAYER_CHOICE_REQUIRED':
                // Always valid - player choices are system-generated
                return { isValid: true };
                
            default:
                // Most events are valid by default
                return { isValid: true };
        }
    }
    
    private validateCardPlayedEvent(event: GameEvent, gameEnv: GameEnvironment): { isValid: boolean; reason?: string } {
        // Placeholder validation for new TCG - implement your specific rules
        console.log(`🔍 Validating card play event (placeholder for new TCG)`);
        
        // TODO: Replace with your TCG-specific validation:
        // - Check if card can be played in current phase
        // - Validate zone compatibility 
        // - Check resource costs (AP/energy)
        // - Verify targeting restrictions
        // - Check once-per-turn limitations
        
        return { isValid: true }; // Always pass for now
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
    
    private createValidationErrorEvent(originalEvent: GameEvent, reason: string): GameEvent {
        return {
            id: `error_${Date.now()}_${Math.random()}`,
            type: 'ERROR_OCCURRED',
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH, // Errors have high priority
            timestamp: Date.now(),
            playerId: originalEvent.playerId,
            data: {
                originalEventType: originalEvent.type,
                originalEventId: originalEvent.id,
                errorReason: reason,
                errorType: 'VALIDATION_FAILED',
                playerId: originalEvent.playerId
            }
        };
    }
    
    private findTriggeredReactions(event: GameEvent, gameEnv: GameEnvironment): GameEvent[] {
        if (!this.triggerEngine) {
            console.log('⚠️ TriggerEngine not set - no reactions checked');
            return [];
        }
        
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
        if (!this.stateBasedEngine) {
            console.log('⚠️ StateBasedActionEngine not set - no state actions checked');
            return [];
        }
        
        console.log('🏛️ Checking for state-based actions...');
        const stateActions = this.stateBasedEngine.checkForStateBasedActions();
        
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
                stateEvents.push(stateEvent);
            }
        });
        
        return stateEvents;
    }

    // ============ DEBUGGING AND UTILITIES ============
    
    getQueueStatus(): { 
        size: number; 
        events: Array<{ type: string; status: string; priority: number }>; 
        needsInput: boolean;
    } {
        return {
            size: this.events.length,
            events: this.events.map(e => ({ 
                type: e.type, 
                status: e.status, 
                priority: e.priority 
            })),
            needsInput: this.needsPlayerInput()
        };
    }
    
    toJSON(): any {
        return {
            events: this.events,
            processingEnabled: this.processingEnabled
        };
    }
    
    static fromJSON(data: any): GameEventQueue {
        const queue = new GameEventQueue();
        queue.events = data.events || [];
        queue.processingEnabled = data.processingEnabled !== false;
        // EventExecutor is already initialized in constructor
        return queue;
    }
}