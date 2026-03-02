// src/services/StaticEventProcessor.ts
// Static event processor for simplified event system

import { GameEvent, EventStatus, EventPriority, ErrorOccurredEventData } from './EventQueue/interfaces/GameEvent';
import { ProcessingResult } from '../models/EventInterfaces';
import { GameEnvironment } from '../models/GameEnvironment';
import { GameEngine } from './GameEngine';
import { EventType } from '../models/GameEnums';
import { TriggerEngine } from './EventQueue/TriggerEngine';
import { StateBasedActionEngine } from './EventQueue/StateBasedActionEngine';
import { StateBasedActionEventFactory } from './EventQueue/StateBasedActionEventFactory';
import { validateEventExecution } from './validation/EventValidator';
import { ContinuousEffectManager } from './ContinuousEffectManager';

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
        
        let lastError: string | null = null;

        while (gameEnv.processingEnabled && 
               gameEnv.processingQueue.length > 0 && 
               !gameEnv.needsPlayerInput() && 
               eventsProcessed < gameEnv.maxEventsPerCycle &&
               iterations < maxIterations) {
            
            iterations++; // Increment iteration counter
            console.log(`⚡ Queue iteration ${iterations}: size=${gameEnv.processingQueue.length}, processed=${eventsProcessed}`);
            console.log('⚡ Queue snapshot:', gameEnv.processingQueue.map(evt => `${evt.type}:${evt.status}`).join(' -> '));

            const event = gameEnv.processingQueue[0]; // Peek at next event
            if (!event) break;
            
            
            console.log(`⚡ Processing event [${iterations}]: ${event.type} (${event.status})`);
            
            try {
                if (event.status === EventStatus.DECLARED) {
                    // ============ DECLARED PHASE ============
                    console.log(`📋 Event declared: ${event.type} - checking for reactions`);
                    
                    // 1. Validation
                    const validationResult = validateEventExecution(event, gameEnv);
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

                    if (event.type === EventType.ERROR_OCCURRED) {
                        const errorData = event.data as ErrorOccurredEventData;
                        if (errorData?.errorReason) {
                            lastError = errorData.errorReason;
                        } else {
                            lastError = 'An error occurred';
                        }
                    }
                    
                    const executionResult = GameEngine.execute(event, gameEnv);
                    if (executionResult.success) {
                        const reactiveResult = ContinuousEffectManager.processReactiveContinuousEffects(gameEnv);
                        if (!reactiveResult.success) {
                            console.error(`❌ Reactive continuous effect execution failed: ${reactiveResult.error}`);
                            lastError = reactiveResult.error || 'Reactive continuous effect execution failed';
                            event.status = EventStatus.RESOLVED;
                            const removed = gameEnv.dequeueFromProcessing(event);
                            if (removed) {
                                eventsProcessed++;
                            } else {
                                gameEnv.processingQueue.shift();
                                eventsProcessed++;
                            }
                            break;
                        }
                        event.status = EventStatus.RESOLVED;
                    } else {
                        console.error(`❌ Event execution failed: ${executionResult.error}`);
                        lastError = executionResult.error || 'Event execution failed';

                        // Resolve and remove the event immediately to avoid reprocessing
                        event.status = EventStatus.RESOLVED;
                        const removed = gameEnv.dequeueFromProcessing(event);
                        if (removed) {
                            eventsProcessed++;
                        } else {
                            console.error(`❌ Failed to remove failed event: ${event.type}`);
                            gameEnv.processingQueue.shift();
                            eventsProcessed++;
                        }

                        break;
                    }
                    
                } else if (event.status === EventStatus.RESOLVED) {
                    // ============ RESOLVED PHASE ============
                    console.log(`✅ Event resolved: ${event.type}`);
                    
                    // Check for state-based actions after resolution
                    const stateActions = this.checkForStateBasedActions(event.playerId, engines.stateEngine);
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

                    if (event.type === EventType.ERROR_OCCURRED && lastError) {
                        break;
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
            success: !lastError,
            eventsProcessed,
            needsPlayerInput: gameEnv.needsPlayerInput(),
            waitingForChoice: typeof waitingForChoice === 'string' ? waitingForChoice : undefined
        };

        if (lastError) {
            result.error = lastError;
        }
        
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
        return this.processQueue(gameEnv);
    }
    
    // ============ REACTION AND TRIGGER METHODS ============
    
    private static findTriggeredReactions(event: GameEvent, _gameEnv: GameEnvironment, triggerEngine: TriggerEngine): GameEvent[] {
        console.log(`🔍 Checking for triggered reactions to: ${event.type}`);
        try {
            return triggerEngine.checkTriggeredAbilities(event);
        } catch (error) {
            console.error(`❌ Error checking triggers:`, error);
            return [];
        }
    }
    
    private static checkForReplacementEffects(event: GameEvent, _gameEnv: GameEnvironment): GameEvent | null {
        // TODO: Implement replacement effects
        console.log(`🔄 Checking replacement effects for: ${event.type}`);
        return null; // No replacement effects for now
    }
    
    private static checkForStateBasedActions(playerId: string, stateEngine: StateBasedActionEngine): GameEvent[] {
        console.log('🏛️ Checking for state-based actions...');
        try {
            const stateActions = stateEngine.checkForStateBasedActions();
            console.log("checking any action ",JSON.stringify(stateActions));
            return StateBasedActionEventFactory.createAutoExecuteEvents(stateActions, playerId);
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
