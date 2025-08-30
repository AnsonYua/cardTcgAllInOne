// src/services/EventQueue/EventProcessor.ts
// Event lifecycle management and processing coordination

import { GameEventQueue, EventQueueOutput } from './GameEventQueue';
import { GameEvent, EventFactory, EventStatus, EventPriority } from './interfaces/GameEvent';
import { TriggerEngine } from './TriggerEngine';
import { EffectStack, StackResolutionResult } from './EffectStack';
import { StateBasedActionEngine } from './StateBasedActionEngine';
import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';

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
        
        console.log('🔧 EventProcessor initialized with integrated TCG engines');
    }
    
    // ============ MAIN PROCESSING INTERFACE ============
    
    /**
     * Process player action and handle resulting events with full TCG system
     */
    async processPlayerAction(action: PlayerAction): Promise<ProcessingResult> {
        try {
            console.log(`🎮 Processing player action: ${action.type}`);
            
            // Convert player action to initial event
            const initialEvent = this.createEventFromAction(action);
            if (initialEvent) {
                this.eventQueue.enqueue(initialEvent);
            }
            
            // Process through full TCG event system
            const result = await this.processFullEventCycle();
            
            return result;
            
        } catch (error) {
            console.error('❌ Error processing player action:', error);
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
    
    // ============ ACTION CONVERSION ============
    
    /**
     * Convert player action to game event
     */
    private createEventFromAction(action: PlayerAction): GameEvent | null {
        switch (action.type) {
            case 'PLAY_CARD':
                return EventFactory.createCardPlayedEvent(
                    action.cardId || '',
                    action.cardUid || action.cardId || '',
                    action.zone || '',
                    action.playerId,
                    action.isFaceDown || false
                );
                
            case 'PHASE_ADVANCE':
                return EventFactory.createPhaseChangeEvent(
                    this.gameEnv.phase,
                    action.targetPhase || GamePhase.MAIN_PHASE,
                    'player_action'
                );
                
            case 'TAP_ENERGY':
                return EventFactory.createEnergyTappedEvent(
                    action.cardId || '',
                    action.cardUid || action.cardId || '',
                    action.playerId,
                    action.energyAmount || 1
                );
                
            default:
                console.warn(`⚠️ Unknown action type: ${action.type}`);
                return null;
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
    
    // ============ HELPER METHODS ============
    
    /**
     * Get the last processed event for trigger checking
     */
    private getLastProcessedEvent(): GameEvent | null {
        // TODO: Track last processed event
        return null;
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

