// src/services/StaticEventProcessor.ts
// Static event processor for simplified event system

import { GameEvent, EventStatus, EventPriority, ErrorOccurredEventData, JoinGameEvent, ConfirmRedrawEvent, TargetChoiceEvent } from './EventQueue/interfaces/GameEvent';
import { ProcessingResult, ValidationResult } from '../models/EventInterfaces';
import { GameEnvironment } from '../models/GameEnvironment';
import { GameEngine } from './GameEngine';
import { GamePhase, EventType } from '../models/GameEnums';
import { TriggerEngine } from './EventQueue/TriggerEngine';
import { StateBasedActionEngine } from './EventQueue/StateBasedActionEngine';

export class StaticEventProcessor {
    // No need for GameEngine instance - all methods are static now
    
    // Create engine instances per processing session for state isolation
    private static createEngineInstances(gameEnv: GameEnvironment) {
        return {
            triggerEngine: new TriggerEngine(gameEnv),
            stateEngine: new StateBasedActionEngine(gameEnv)
        };
    }
    
    /**
     * Main event processing method - processes events until blocked or queue empty
     */
    public static processQueue(gameEnv: GameEnvironment): ProcessingResult {
        let eventsProcessed = 0;
        let iterations = 0; // Safety counter to prevent infinite loops
        const maxIterations = gameEnv.maxEventsPerCycle || 50;
        const engines = this.createEngineInstances(gameEnv);
        
        console.log(`⚡ Starting event processing - queue size: ${gameEnv.processingQueue.length}`);
        
        while (gameEnv.processingEnabled && 
               gameEnv.processingQueue.length > 0 && 
               !gameEnv.needsPlayerInput() && 
               eventsProcessed < gameEnv.maxEventsPerCycle &&
               iterations < maxIterations) {
            
            iterations++; // Increment iteration counter
            console.log(`⚡ Queue: ${gameEnv.processingQueue.length}, processed: ${eventsProcessed}, iteration: ${iterations}`);

            const event = gameEnv.processingQueue[0]; // Peek at next event
            if (!event) break;
            
            
            console.log(`⚡ Processing event [${iterations}]: ${event.type} (${event.status})`);
            
            try {
                if (event.status === EventStatus.DECLARED) {
                    // ============ DECLARED PHASE ============
                    console.log(`📋 Event declared: ${event.type} - checking for reactions`);
                    
                    // 1. Validation
                    const validationResult = this.validateEventExecution(event, gameEnv);
                    if (!validationResult.isValid) {
                        console.log(`❌ Event ${event.type} failed validation: ${validationResult.reason}`);
                        this.replaceEventWithError(gameEnv, event, validationResult.reason || 'Unknown validation error');
                        continue;
                    }
                    
                    // 2. Check for triggered reactions
                    const reactions = this.findTriggeredReactions(event, gameEnv, engines.triggerEngine);
                    reactions.forEach(reaction => {
                        console.log(`🔗 Adding triggered reaction: ${reaction.type}`);
                        gameEnv.enqueueForProcessing(reaction);
                    });
                    
                    // 3. Check for replacement effects
                    const replacement = this.checkForReplacementEffects(event, gameEnv);
                    if (replacement) {
                        console.log(`🔄 Event ${event.type} replaced by ${replacement.type}`);
                        this.replaceEvent(gameEnv, event, replacement);
                        continue;
                    }
                    
                    // 4. Ready to resolve
                    console.log(`🔄 Event ${event.type} transitioning DECLARED → RESOLVING`);
                    event.status = EventStatus.RESOLVING;
                    
                } else if (event.status === EventStatus.RESOLVING) {
                    // ============ RESOLVING PHASE ============
                    console.log(`🔥 Executing event: ${event.type}`);
                    
                    const executionResult = GameEngine.execute(event, gameEnv);
                    
                    if (executionResult.success) {
                        event.status = EventStatus.RESOLVED;
                    } else {
                        console.error(`❌ Event execution failed: ${executionResult.error}`);
                        // Mark as resolved to prevent infinite loop, but log error
                        event.status = EventStatus.RESOLVED;
                    }
                    
                } else if (event.status === EventStatus.RESOLVED) {
                    // ============ RESOLVED PHASE ============
                    console.log(`✅ Event resolved: ${event.type}`);
                    
                    // Check for state-based actions after resolution
                    const stateActions = this.checkForStateBasedActions(gameEnv, event.playerId,engines.stateEngine);
                    stateActions.forEach(stateEvent => {
                        console.log(`🏛️ Adding state-based action: ${stateEvent.type}`);
                        gameEnv.enqueueForProcessing(stateEvent);
                    });
                    
                    // Remove the specific resolved event from queue (safer than shift)
                    const removed = gameEnv.dequeueFromProcessing(event);
                    if (removed) {
                        eventsProcessed++;
                    } else {
                        console.error(`❌ Failed to remove resolved event: ${event.type}`);
                        // Fallback to prevent infinite loop
                        gameEnv.processingQueue.shift();
                        eventsProcessed++;
                    }
                }

                
            } catch (error) {
                console.error(`💥 Error processing event ${event.type}:`, error);
                // Remove problematic event to prevent infinite loop
                const removed = gameEnv.dequeueFromProcessing(event);
                if (removed) {
                    eventsProcessed++;
                } else {
                    console.error(`❌ Failed to remove error event: ${event.type}`);
                    // Fallback to prevent infinite loop
                    gameEnv.processingQueue.shift();
                    eventsProcessed++;
                }
                
                // Add error event
                this.addErrorEvent(gameEnv, event, error instanceof Error ? error.message : 'Unknown processing error');
            }
        }
        
        const currentChoiceEvent = gameEnv.getCurrentPlayerChoice();
        const waitingForChoice = currentChoiceEvent && typeof currentChoiceEvent.data === 'object'
            ? (currentChoiceEvent.data as Record<string, unknown>)['choiceId']
            : undefined;

        const result: ProcessingResult = {
            success: true,
            eventsProcessed,
            needsPlayerInput: gameEnv.needsPlayerInput(),
            waitingForChoice: typeof waitingForChoice === 'string' ? waitingForChoice : undefined
        };
        
        console.log(`📊 Event processing complete: ${eventsProcessed} events processed (${iterations} iterations)`);
        
        // Debug infinite loop detection
        if (iterations >= maxIterations) {
            console.error(`⚠️ Event processing stopped due to iteration limit (${maxIterations})`);
            console.error(`Queue still has ${gameEnv.processingQueue.length} events`);
            if (gameEnv.processingQueue.length > 0) {
                console.error(`Next event: ${gameEnv.processingQueue[0].type} (${gameEnv.processingQueue[0].status})`);
            }
        }
        
        return result;
    }
    
    /**
     * Process single event directly (utility method)
     */
    public static async processEvent(gameEnv: GameEnvironment, event: GameEvent): Promise<ProcessingResult> {
        console.log(`🎮 Processing single event: ${event.type}`);
        
        // Add event to queue
        gameEnv.enqueueForProcessing(event);
        
        // Process the queue
        const result = this.processQueue(gameEnv);
        
        // Check if any error events were generated
        if (gameEnv.notificationQueue) {
            const recentErrors = gameEnv.notificationQueue.filter(evt => 
                evt.type === EventType.ERROR_OCCURRED && 
                evt.timestamp > (Date.now() - 1000)
            );
            
            if (recentErrors.length > 0) {
                const latestError = recentErrors[recentErrors.length - 1];
                const errorData = latestError.data as ErrorOccurredEventData;
                return {
                    success: false,
                    eventsProcessed: result.eventsProcessed,
                    needsPlayerInput: result.needsPlayerInput,
                    error: typeof errorData.errorReason === 'string' ? errorData.errorReason : 'Validation failed'
                };
            }
        }
        
        return result;
    }
    
    // ============ VALIDATION METHODS ============
    
    private static validateEventExecution(event: GameEvent, gameEnv: GameEnvironment): ValidationResult {
        console.log(`🔍 Validating event: ${event.type}`);
        
        switch (event.type) {
            case EventType.JOIN_GAME:
                return this.validateJoinGameEvent(event as JoinGameEvent, gameEnv);
                
            case EventType.CONFIRM_REDRAW:
                return this.validateStartReadyEvent(event as ConfirmRedrawEvent, gameEnv);
                
                
            default:
                // Most events are valid by default
                return { isValid: true };
        }
    }
    
    private static validateJoinGameEvent(event: JoinGameEvent, gameEnv: GameEnvironment): ValidationResult {
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
    
    private static validateStartReadyEvent(event: ConfirmRedrawEvent, gameEnv: GameEnvironment): ValidationResult {
        const { playerId } = event;
        
        // Basic validation: Check if player exists in game
        if (playerId !== gameEnv.playerId_1 && playerId !== gameEnv.playerId_2) {
            return {
                isValid: false,
                reason: 'Player not found in game'
            };
        }
        
        return { isValid: true };
    }
    
    // ============ REACTION AND TRIGGER METHODS ============
    
    private static findTriggeredReactions(event: GameEvent, gameEnv: GameEnvironment, triggerEngine: TriggerEngine): GameEvent[] {
        console.log(`🔍 Checking for triggered reactions to: ${event.type}`);
        try {
            return triggerEngine.checkTriggeredAbilities(event);
        } catch (error) {
            console.error(`❌ Error checking triggers:`, error);
            return [];
        }
    }
    
    private static checkForReplacementEffects(event: GameEvent, gameEnv: GameEnvironment): GameEvent | null {
        // TODO: Implement replacement effects
        console.log(`🔄 Checking replacement effects for: ${event.type}`);
        return null; // No replacement effects for now
    }
    
    private static checkForStateBasedActions(gameEnv: GameEnvironment, playerId:string,stateEngine: StateBasedActionEngine): GameEvent[] {
        console.log('🏛️ Checking for state-based actions...');
        try {
            const stateActions = stateEngine.checkForStateBasedActions();
            console.log("checking any action ",JSON.stringify(stateActions))
            // Convert state-based actions to events - minimal conversion
            const stateEvents: GameEvent[] = [];
            stateActions.forEach(action => {
                if (action.autoExecute) {
                    const stateEvent: GameEvent = {
                        id: `state_${Date.now()}_${Math.random()}`,
                        type: action.type,
                        status: EventStatus.DECLARED,
                        priority: EventPriority.HIGH,
                        timestamp: Date.now(),
                        playerId:playerId,
                        // Pass action data directly without field reconstruction
                        data: action.data || {}
                    };
                    
                    stateEvents.push(stateEvent);
                }
            });
            
            return stateEvents;
        } catch (error) {
            console.error(`❌ Error checking state-based actions:`, error);
            return [];
        }
    }
    
    // ============ ERROR HANDLING METHODS ============
    
    private static replaceEventWithError(gameEnv: GameEnvironment, originalEvent: GameEvent, reason: string): void {
        const errorEvent: GameEvent = {
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
        
        // Replace the original event with error event
        const index = gameEnv.processingQueue.findIndex(e => e.id === originalEvent.id);
        if (index !== -1) {
            gameEnv.processingQueue[index] = errorEvent;
        }
    }
    
    private static replaceEvent(gameEnv: GameEnvironment, originalEvent: GameEvent, replacementEvent: GameEvent): void {
        const index = gameEnv.processingQueue.findIndex(e => e.id === originalEvent.id);
        if (index !== -1) {
            gameEnv.processingQueue[index] = replacementEvent;
            console.log(`🔄 Event replaced: ${originalEvent.type} → ${replacementEvent.type}`);
        }
    }
    
    private static addErrorEvent(gameEnv: GameEnvironment, originalEvent: GameEvent, reason: string): void {
        const errorEvent: GameEvent = {
            id: `error_${Date.now()}_${Math.random()}`,
            type: EventType.ERROR_OCCURRED,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            timestamp: Date.now(),
            playerId: originalEvent.playerId,
            data: {
                originalEventType: originalEvent.type,
                originalEventId: originalEvent.id,
                errorReason: reason,
                errorType: 'PROCESSING_ERROR',
                playerId: originalEvent.playerId
            }
        };
        
        gameEnv.enqueueForProcessing(errorEvent);
    }
    
    // ============ UTILITY METHODS ============
    
    /**
     * Handle player choice resolution
     */
    public static async resolvePlayerChoice(gameEnv: GameEnvironment, selectionId: string, choices: string[]): Promise<ProcessingResult> {
        console.log(`🎯 Resolving player choice: ${selectionId}`);
        
        // Find pending choice event
        const choiceEvent = gameEnv.getCurrentPlayerChoice() as TargetChoiceEvent | null;
        if (!choiceEvent || choiceEvent.data.choiceId !== selectionId) {
            return {
                success: false,
                eventsProcessed: 0,
                needsPlayerInput: false,
                error: 'No matching player choice found'
            };
        }

        // Generate choice resolution event
        const resolveEvent: GameEvent = {
            id: `choice_resolved_${Date.now()}_${Math.random()}`,
            type: EventType.PLAYER_CHOICE_RESOLVED,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId: choiceEvent.playerId,
            timestamp: Date.now(),
            data: { choiceId: selectionId, choices, playerId: choiceEvent.playerId }
        };
        
        // Mark choice event as resolved and add resolution event
        choiceEvent.status = EventStatus.RESOLVED;
        gameEnv.enqueueForProcessing(resolveEvent);
        
        // Continue processing
        return this.processQueue(gameEnv);
    }
    
    /**
     * Get system status for debugging
     */
    public static getSystemStatus(gameEnv: GameEnvironment): any {
        return {
            eventQueue: {
                size: gameEnv.processingQueue.length,
                events: gameEnv.processingQueue.map(e => ({ 
                    type: e.type, 
                    status: e.status, 
                    priority: e.priority 
                })),
                needsInput: gameEnv.needsPlayerInput()
            },
            processing: {
                enabled: gameEnv.processingEnabled,
                maxEventsPerCycle: gameEnv.maxEventsPerCycle
            }
        };
    }
}
