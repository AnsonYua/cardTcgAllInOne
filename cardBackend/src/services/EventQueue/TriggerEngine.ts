// src/services/EventQueue/TriggerEngine.ts
// Reactive event system for triggered abilities and continuous effects

import { GameEvent, EventFactory } from './interfaces/GameEvent';
import { GameEnvironment } from '../../models/GameEnvironment';

// ============ TRIGGER SYSTEM INTERFACES ============

export interface TriggerCondition {
    eventTypes: string[];
    cardFilters?: CardFilter[];
    playerFilters?: PlayerFilter[];
    zoneFilters?: string[];
    customCondition?: (event: GameEvent, gameEnv: GameEnvironment) => boolean;
}

export interface CardFilter {
    gameTypes?: string[];
    traits?: string[];
    zones?: string[];
    playerId?: string;
    minPower?: number;
    maxPower?: number;
}

export interface PlayerFilter {
    playerId?: string;
    isOpponent?: boolean;
    isCurrentPlayer?: boolean;
}

export interface RegisteredTrigger {
    triggerId: string;
    sourceCardId: string;
    sourceCarduid: string;
    abilityId: string;
    condition: TriggerCondition;
    isOptional: boolean;
    priority: number;
    isActive: boolean;
}

export interface ContinuousEffect {
    effectId: string;
    sourceCardId: string;
    sourceCarduid: string;
    effectType: string;
    targets: CardFilter;
    modification: any;
    layer: number;
    isActive: boolean;
}

// ============ TRIGGER ENGINE CLASS ============

export class TriggerEngine {
    private registeredTriggers: Map<string, RegisteredTrigger[]> = new Map();
    private continuousEffects: ContinuousEffect[] = [];
    private gameEnv: GameEnvironment;
    
    constructor(gameEnv: GameEnvironment) {
        this.gameEnv = gameEnv;
        console.log('🎯 TriggerEngine initialized');
    }
    
    // ============ TRIGGER REGISTRATION ============
    
    /**
     * Register a triggered ability
     */
    registerTrigger(trigger: RegisteredTrigger): void {
        trigger.condition.eventTypes.forEach(eventType => {
            if (!this.registeredTriggers.has(eventType)) {
                this.registeredTriggers.set(eventType, []);
            }
            this.registeredTriggers.get(eventType)!.push(trigger);
        });
        
        console.log(`🎯 Trigger registered: ${trigger.abilityId} (${trigger.condition.eventTypes.join(', ')})`);
    }
    
    /**
     * Unregister triggers for a card (when card leaves play)
     */
    unregisterTriggersForCard(carduid: string): void {
        this.registeredTriggers.forEach((triggers, eventType) => {
            const filtered = triggers.filter(t => t.sourceCarduid !== carduid);
            if (filtered.length !== triggers.length) {
                this.registeredTriggers.set(eventType, filtered);
                console.log(`🎯 Triggers unregistered for card: ${carduid}`);
            }
        });
    }
    
    // ============ CONTINUOUS EFFECTS ============
    
    /**
     * Register a continuous effect
     */
    registerContinuousEffect(effect: ContinuousEffect): void {
        this.continuousEffects.push(effect);
        
        // Sort by layer for proper application order
        this.continuousEffects.sort((a, b) => a.layer - b.layer);
        
        console.log(`🔄 Continuous effect registered: ${effect.effectId} (layer ${effect.layer})`);
    }
    
    /**
     * Remove continuous effects for a card
     */
    removeContinuousEffectsForCard(carduid: string): void {
        const originalLength = this.continuousEffects.length;
        this.continuousEffects = this.continuousEffects.filter(e => e.sourceCarduid !== carduid);
        
        if (this.continuousEffects.length !== originalLength) {
            console.log(`🔄 Continuous effects removed for card: ${carduid}`);
        }
    }
    
    // ============ EVENT PROCESSING ============
    
    /**
     * Check for triggered abilities when an event occurs
     */
    checkTriggeredAbilities(event: GameEvent): GameEvent[] {
        const triggeredEvents: GameEvent[] = [];
        
        const triggers = this.registeredTriggers.get(event.type) || [];
        
        for (const trigger of triggers) {
            if (!trigger.isActive) continue;
            
            // Check if trigger condition is met
            if (this.evaluateTriggerCondition(trigger.condition, event)) {
                console.log(`🎯 Trigger activated: ${trigger.abilityId} from ${trigger.sourceCardId}`);
                
                const abilityEvent = EventFactory.createAbilityTriggeredEvent(
                    trigger.abilityId,
                    trigger.sourceCardId,
                    trigger.sourceCarduid,
                    event.playerId || '',
                    event.type,
                    trigger.isOptional
                );
                
                triggeredEvents.push(abilityEvent);
            }
        }
        
        // Sort by priority
        triggeredEvents.sort((a, b) => a.priority - b.priority);
        
        return triggeredEvents;
    }
    
    /**
     * Apply all continuous effects to game state
     */
    applyContinuousEffects(): void {
        console.log(`🔄 Applying ${this.continuousEffects.length} continuous effects`);
        
        for (const effect of this.continuousEffects) {
            if (!effect.isActive) continue;
            
            // TODO: Integrate with your card effect system
            // Apply continuous effect to matching targets
            this.applyContinuousEffect(effect);
        }
    }
    
    /**
     * Check for state-based actions that need to be performed
     */
    checkStateBasedActions(): GameEvent[] {
        const stateActions: GameEvent[] = [];
        
        // TODO: Implement state-based action checks
        // Examples:
        // - Units with 0 or negative power are destroyed
        // - Hand size limit enforcement
        // - Zone capacity limits
        // - Illegal game state corrections
        
        console.log(`🔍 State-based actions check: ${stateActions.length} actions needed`);
        return stateActions;
    }
    
    // ============ HELPER METHODS ============
    
    /**
     * Evaluate if a trigger condition is met
     */
    private evaluateTriggerCondition(condition: TriggerCondition, event: GameEvent): boolean {
        // Check event type match
        if (!condition.eventTypes.includes(event.type)) {
            return false;
        }
        
        // TODO: Implement filter evaluation
        // - Check card filters against event data
        // - Check player filters
        // - Check zone filters
        // - Execute custom condition if provided
        
        // For now, simple event type matching
        return true;
    }
    
    /**
     * Apply a single continuous effect
     */
    private applyContinuousEffect(effect: ContinuousEffect): void {
        console.log(`🔄 Applying continuous effect: ${effect.effectId}`);
        
        // TODO: Integrate with your existing card effect system
        // Apply the effect modification to all matching targets
        // Examples:
        // - Power modifications
        // - Ability grants/removals
        // - Zone restrictions
        // - Cost modifications
    }
    
    // ============ INTEGRATION HELPERS ============
    
    /**
     * Initialize triggers for a card entering play
     */
    initializeCardTriggers(cardId: string, carduid: string, playerId: string): void {
        // TODO: Load card data and register its triggered abilities
        console.log(`🎯 Initializing triggers for card: ${cardId}`);
        
        // Example integration:
        // const cardData = getCardData(cardId);
        // if (cardData.abilities) {
        //     cardData.abilities.forEach(ability => {
        //         if (ability.trigger) {
        //             this.registerTrigger(createTriggerFromAbility(ability, carduid, playerId));
        //         }
        //         if (ability.continuous) {
        //             this.registerContinuousEffect(createEffectFromAbility(ability, carduid, playerId));
        //         }
        //     });
        // }
    }
    
    /**
     * Clean up triggers when card leaves play
     */
    cleanupCardEffects(carduid: string): void {
        this.unregisterTriggersForCard(carduid);
        this.removeContinuousEffectsForCard(carduid);
        console.log(`🧹 Cleaned up all effects for card: ${carduid}`);
    }
    
    // ============ SERIALIZATION ============
    
    /**
     * Serialize trigger engine state
     */
    toJSON(): any {
        return {
            registeredTriggers: Array.from(this.registeredTriggers.entries()),
            continuousEffects: this.continuousEffects
        };
    }
    
    /**
     * Restore trigger engine from serialized state
     */
    static fromJSON(data: any, gameEnv: GameEnvironment): TriggerEngine {
        const engine = new TriggerEngine(gameEnv);
        
        if (data.registeredTriggers) {
            engine.registeredTriggers = new Map(data.registeredTriggers);
        }
        
        if (data.continuousEffects) {
            engine.continuousEffects = data.continuousEffects;
        }
        
        return engine;
    }
}