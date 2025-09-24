// Event system interfaces for trading card game

import { EventType } from '../../../models/GameEnums';

export enum EventStatus {
    DECLARED = 'DECLARED',
    RESOLVING = 'RESOLVING', 
    RESOLVED = 'RESOLVED'
}

export enum EventPriority {
    IMMEDIATE = 0,
    HIGH = 1,
    NORMAL = 2,
    LOW = 3
}

export interface BaseGameEvent {
    id: string;
    type: EventType;
    status: EventStatus;
    priority: EventPriority;
    sourceId?: string;
    playerId?: string;
    timestamp: number;
    data: any;
    reactionsPolled?: boolean;
}




export interface StartGameEvent extends BaseGameEvent {
    type: EventType.CREATE_GAME;
    data: {
        playerId: string;
        gameId: string;
        timestamp: number;
    };
}

export interface JoinGameEvent extends BaseGameEvent {
    type: EventType.JOIN_GAME;
    data: {
        playerId: string;
        gameId: string;
        timestamp: number;
    };
}

export interface PowerBoostEvent extends BaseGameEvent {
    type: EventType.RESOURCE_GAINED;
    data: {
        carduid: string;        // CHANGED: Use carduid instead of cardId
        value: number;
        playerId: string;
    };
}

// ============ LOGICAL GAME FLOW EVENTS ============

export interface TurnStartEvent extends BaseGameEvent {
    type: EventType.TURN_CHANGE;
    data: {
        playerId: string;
        turnNumber: number;
        phase: string;
    };
}

export interface TurnEndEvent extends BaseGameEvent {
    type: EventType.TURN_CHANGE;
    data: {
        playerId: string;
        turnNumber: number;
        nextPlayerId: string;
    };
}

export interface StepBeginEvent extends BaseGameEvent {
    type: EventType.PHASE_ADVANCE;
    data: {
        step: string;
        playerId: string;
        allowsResponses: boolean;
    };
}

export interface NextPlayerTurnEvent extends BaseGameEvent {
    type: EventType.NEXT_PLAYER_TURN;
    data: {
        currentPlayer: string;
        nextPlayer: string;
        currentTurn: number;
    };
}

export interface StepEndEvent extends BaseGameEvent {
    type: EventType.PHASE_ADVANCE;
    data: {
        step: string;
        playerId: string;
    };
}

// ============ CARD LIFECYCLE EVENTS ============

export interface CardEntersPlayEvent extends BaseGameEvent {
    type: EventType.CARD_ENTERS_PLAY;
    data: {
        carduid: string;         // PRIMARY: Use carduid as single source of truth
        zone: string;
        playerId: string;
        wasFromHand: boolean;
        faceDown: boolean;
        // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    };
}




// ============ RESOURCE & ENERGY EVENTS ============


export interface CostPaidEvent extends BaseGameEvent {
    type: EventType.RESOURCE_GAINED;
    data: {
        carduid: string;         // CHANGED: Use carduid instead of cardId
        cost: number;
        paymentCards: string[];  // These are carduids too
        playerId: string;
    };
}

// ============ TRIGGERED ABILITY EVENTS ============

export interface AbilityTriggeredEvent extends BaseGameEvent {
    type: EventType.TRIGGER_HEALING;
    data: {
        abilityId: string;
        sourceCardId: string;
        sourceCarduid: string;
        playerId: string;
        triggerCondition: string;
        isOptional: boolean;
        targets?: string[];
    };
}

export interface AbilityActivatedEvent extends BaseGameEvent {
    type: EventType.TRIGGER_HEALING;
    data: {
        abilityId: string;
        sourceCardId: string;
        sourceCarduid: string;
        playerId: string;
        cost?: number;
        targets?: string[];
    };
}

export interface AbilityResolvedEvent extends BaseGameEvent {
    type: EventType.TRIGGER_HEALING;
    data: {
        abilityId: string;
        sourceCardId: string;
        effects: any[];
        playerId: string;
    };
}

// ============ COMBAT EVENTS ============

export interface AttackDeclaredEvent extends BaseGameEvent {
    type: EventType.TRIGGER_HEALING;
    data: {
        attackerId: string;
        attackerUid: string;
        targetId?: string;
        targetUid?: string;
        playerId: string;
    };
}

export interface DamageDealtEvent extends BaseGameEvent {
    type: EventType.TRIGGER_HEALING;
    data: {
        sourceId: string;
        targetId: string;
        targetUid: string;
        damage: number;
        damageType: string;
        playerId: string;
    };
}

// ============ STATE-BASED ACTION EVENTS ============

export interface StateBasedActionEvent extends BaseGameEvent {
    type: EventType.STATE_BASED_ACTION;
    data: {
        action: string;
        affectedCards: string[];
        reason: string;
    };
}

export interface EndTurnEvent extends BaseGameEvent {
    type: EventType.END_TURN;
    data: {
        playerId: string;
        currentTurnNumber: number;
        timestamp: number;
    };
}

export interface AcknowledgeEventsEvent extends BaseGameEvent {
    type: EventType.ACKNOWLEDGE_EVENTS;
    data: {
        eventIds: string[];
        acknowledgedCount?: number;
    };
}

// ============ SHIELD ATTACK EVENTS ============

export interface ShieldCardAttackedEvent extends BaseGameEvent {
    type: EventType.SHIELD_CARD_ATTACKED;
    data: {
        defendingPlayerId: string;
        attackingPlayerId: string;
        attackerSlot: string;
        shieldCards: Array<{
            carduid: string;
            // REMOVED: cardId - use getCardIdFromUid(carduid) instead
            cardData: any;
        }>;
        attackPower: number;
    };
}

export interface BurstEffectChoiceEvent extends BaseGameEvent {
    type: EventType.BURST_EFFECT_CHOICE;
    data: {
        playerId: string;
        availableTargets: Array<any>;
        choiceId: string;
        userDecisionMade: boolean;
        userDecision?: 'ACTIVATE' | 'DECLINE';
    };
}

export interface TargetChoiceEvent extends BaseGameEvent {
    type: EventType.TARGET_CHOICE;
    data: {
        // Common fields
        playerId: string;           // Player making the choice
        choiceId: string;           // Unique choice identifier
        userDecisionMade: boolean;  // Choice completion status
        
        // Source information
        sourceCarduid: string;      // Card triggering the effect
        
        // Effect information
        effect: {
            effectId: string;
            action: string;         // 'modifyAP', 'damage', 'rest', etc.
            parameters: any;        // Effect parameters
            description?: string;
        };
        
        // Available targets (computed)
        availableTargets: Array<{
            carduid: string;
            // REMOVED: cardId - use getCardIdFromUid(carduid) instead
            zone: string;
            playerId: string;
            cardData?: any;         // For display purposes
        }>;
        
        // User selection result
        selectedTargets?: Array<{
            carduid: string;
            zone: string;
            playerId: string;
        }>;
    };
}

export type GameEvent = 
    | AcknowledgeEventsEvent
    | PowerBoostEvent
    | TurnStartEvent
    | TurnEndEvent 
    | StepBeginEvent
    | StepEndEvent
    | CardEntersPlayEvent
    | CostPaidEvent
    | AbilityTriggeredEvent
    | AbilityActivatedEvent
    | AbilityResolvedEvent
    | AttackDeclaredEvent
    | DamageDealtEvent
    | StateBasedActionEvent
    | EndTurnEvent
    | StartGameEvent
    | JoinGameEvent
    | BaseGameEvent
    | NextPlayerTurnEvent
    | ShieldCardAttackedEvent
    | BurstEffectChoiceEvent
    | TargetChoiceEvent;

export class EventFactory {
    private static eventIdCounter = 0;
    
    
    static createChoiceResolvedEvent(
        selectionId: string,
        choices: string[],
        playerId: string
    ): BaseGameEvent {
        return {
            id: `choice_resolved_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.PLAYER_CHOICE_RESOLVED,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId,
            timestamp: Date.now(),
            data: { selectionId, choices, playerId }
        };
    }
    
    
    // ============ GAME FLOW EVENT FACTORIES ============
    
    static createTurnStartEvent(playerId: string, turnNumber: number, phase: string): TurnStartEvent {
        return {
            id: `turn_start_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TURN_CHANGE,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: { playerId, turnNumber, phase }
        };
    }
    
    static createTurnEndEvent(playerId: string, turnNumber: number, nextPlayerId: string): TurnEndEvent {
        return {
            id: `turn_end_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TURN_CHANGE,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: { playerId, turnNumber, nextPlayerId }
        };
    }
    
    static createStepBeginEvent(step: string, playerId: string, allowsResponses: boolean = true): StepBeginEvent {
        return {
            id: `step_begin_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.PHASE_ADVANCE,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: { step, playerId, allowsResponses }
        };
    }
    
    // ============ CARD LIFECYCLE EVENT FACTORIES ============
    
    static createCardEntersPlayEvent(
        carduid: string,        // SIMPLIFIED: Only need carduid, derive cardId internally
        zone: string,
        playerId: string,
        wasFromHand: boolean = true,
        faceDown: boolean = false
    ): CardEntersPlayEvent {
        // Import getCardIdFromUid at runtime to avoid circular dependencies
        const { getCardIdFromUid } = require('../../utils/CardUtils');
        const cardId = getCardIdFromUid(carduid);
        
        return {
            id: `card_enters_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.CARD_ENTERS_PLAY,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: cardId,      // Use derived cardId for sourceId
            playerId,
            timestamp: Date.now(),
            data: { carduid, zone, playerId, wasFromHand, faceDown }  // No redundant cardId
        };
    }
    
    
    // ============ ABILITY EVENT FACTORIES ============
    
    static createAbilityTriggeredEvent(
        abilityId: string,
        sourceCarduid: string,      // CHANGED: Removed redundant sourceCardId parameter
        playerId: string,
        triggerCondition: string,
        isOptional: boolean = false,
        targets?: string[]
    ): AbilityTriggeredEvent {
        // Import getCardIdFromUid at runtime to avoid circular dependencies
        const { getCardIdFromUid } = require('../../utils/CardUtils');
        const sourceCardId = getCardIdFromUid(sourceCarduid);
        
        return {
            id: `ability_triggered_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TRIGGER_HEALING,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            sourceId: sourceCardId,      // Use derived sourceCardId
            playerId,
            timestamp: Date.now(),
            data: { abilityId, sourceCardId, sourceCarduid, playerId, triggerCondition, isOptional, targets }
        };
    }
    
    static createAbilityActivatedEvent(
        abilityId: string,
        sourceCarduid: string,      // CHANGED: Removed redundant sourceCardId parameter
        playerId: string,
        cost?: number,
        targets?: string[]
    ): AbilityActivatedEvent {
        // Import getCardIdFromUid at runtime to avoid circular dependencies
        const { getCardIdFromUid } = require('../../utils/CardUtils');
        const sourceCardId = getCardIdFromUid(sourceCarduid);
        
        return {
            id: `ability_activated_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TRIGGER_HEALING,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: sourceCardId,      // Use derived sourceCardId
            playerId,
            timestamp: Date.now(),
            data: { abilityId, sourceCardId, sourceCarduid, playerId, cost, targets }
        };
    }
    
    // ============ RESOURCE EVENT FACTORIES ============
    
    // ============ GAME LIFECYCLE EVENT FACTORIES ============
    
    static createStartGameEvent(playerId: string, gameId: string): StartGameEvent {
        return {
            id: `start_game_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.CREATE_GAME,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: { playerId, gameId, timestamp: Date.now() }
        };
    }
    
    static createJoinGameEvent(playerId: string, gameId: string): JoinGameEvent {
        return {
            id: `join_game_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.JOIN_GAME,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: { playerId, gameId, timestamp: Date.now() }
        };
    }
    
    static createEndTurnEvent(playerId: string, currentTurnNumber: number): EndTurnEvent {
        return {
            id: `end_turn_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.END_TURN,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: { playerId, currentTurnNumber, timestamp: Date.now() }
        };
    }
    
    static createAcknowledgeEventsEvent(playerId: string, eventIds: string[]): AcknowledgeEventsEvent {
        return {
            id: `acknowledge_events_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.ACKNOWLEDGE_EVENTS,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId,
            timestamp: Date.now(),
            data: { eventIds, acknowledgedCount: 0 }
        };
    }
    
    // ============ SHIELD ATTACK EVENT FACTORIES ============
    
    static createShieldCardAttackedEvent(
        defendingPlayerId: string,
        attackingPlayerId: string,
        attackerSlot: string,
        shieldCards: Array<{ carduid: string; cardData: any }>,  // SIMPLIFIED: Removed redundant cardId
        attackPower: number
    ): ShieldCardAttackedEvent {
        return {
            id: `shield_attacked_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.SHIELD_CARD_ATTACKED,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId: defendingPlayerId,
            timestamp: Date.now(),
            data: {
                defendingPlayerId,
                attackingPlayerId,
                attackerSlot,
                shieldCards,        // Pass simplified shieldCards without cardId
                attackPower
            }
        };
    }
    
    static createBurstEffectChoiceEvent(
        playerId: string,
        cards: Array<any>
    ): BurstEffectChoiceEvent {
        return {
            id: `burst_choice_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.BURST_EFFECT_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: {
                playerId,
                availableTargets: cards,
                choiceId: `burst_choice_${Date.now()}`,
                userDecisionMade: false,
                userDecision: undefined
            }
        };
    }
    
    static createTargetChoiceEvent(params: {
        playerId: string;
        sourceCarduid: string;
        effect: any;
        availableTargets: any[];
    }): TargetChoiceEvent {
        const { playerId, sourceCarduid, effect, availableTargets } = params;
        const effectKey = effect?.effectId || effect?.action || 'effect';
        const eventData = {
            playerId,
            choiceId: `target_choice_${effectKey}_${Date.now()}`,
            userDecisionMade: false,
            sourceCarduid,
            effect,
            availableTargets,
            selectedTargets: undefined
        };

        return {
            id: `target_choice_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TARGET_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: eventData    // Pass eventData object directly without reconstruction
        };
    }
    
    // ============ GAME-SPECIFIC EVENT FACTORIES (Moved from GameEventFactory.ts) ============
    
    /**
     * Create Pairing effect event for processing queue
     */
    static createPairingEffectEvent(eventData: any, pairingEffects: any[], placementResult: any): GameEvent {
        // Pass objects directly without reconstruction to minimize conversions
        const eventDataObject = {
            playerId: eventData.playerId,  // Pass playerId directly from eventData
            effects: pairingEffects        // Pass effects array directly
        };

        const pairingEvent: GameEvent = {
            id: `pairing_${eventData.carduid}_${Date.now()}`,
            type: EventType.PAIRING_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId: eventData.playerId,
            data: eventDataObject,          // Pass eventDataObject directly
            timestamp: Date.now()
        };

        console.log(`🤝 Created Pairing event: ${pairingEvent.id} with ${pairingEffects.length} effects`);
        return pairingEvent;
    }

    /**
     * Create PLAY_CARD event for burst deploy effects
     */
    static createBurstDeployEvent(playerId: string, carduid: string, cardData: any, burstEffect: any): GameEvent {
        // Import getCardIdFromUid at runtime to avoid circular dependencies
        const { getCardIdFromUid } = require('../../utils/CardUtils');
        
        // Determine playAs based on card type and burst effect - minimize conversions
        const playAs = (cardData.cardType === 'command' && burstEffect.effect?.action === 'designate_pilot') 
            ? 'pilot' 
            : cardData.cardType;

        // Create data object directly to minimize conversions
        const eventData = {
            playerId,                          // Pass playerId directly
            carduid: carduid,                  // Pass carduid directly
            cardId: getCardIdFromUid(carduid), // CHANGED: Derive cardId from carduid instead of cardData
            cardData,                          // Pass cardData object directly
            playAs,                            // Use computed playAs value
            fromBurst: true
        };

        const playCardEvent: GameEvent = {
            id: `burst_deploy_${Date.now()}_${Math.random()}`,
            type: EventType.PLAY_CARD,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            timestamp: Date.now(),
            playerId,
            data: eventData                    // Pass eventData object directly
        };

        console.log(`🚀 Created burst deploy PLAY_CARD event: ${playCardEvent.id} (playAs: ${playAs})`);
        return playCardEvent;
    }

    /**
     * Create Deploy effect event for processing queue
     */
    static createDeployEffectEvent(eventData: any, deployEffects: any[]): GameEvent {
        // Import getCardIdFromUid at runtime to avoid circular dependencies
        const { getCardIdFromUid } = require('../../utils/CardUtils');
        
        // Create event data object directly from input to minimize conversions
        const eventDataObject = {
            cardId: getCardIdFromUid(eventData.carduid), // CHANGED: Derive cardId from carduid
            carduid: eventData.carduid,        // Pass carduid directly from eventData
            cardData: eventData.cardData,      // Pass cardData object directly from eventData
            playerId: eventData.playerId,      // Pass playerId directly from eventData
            zone: eventData.zone,              // Pass zone directly from eventData
            effects: deployEffects,            // Pass effects array directly
            timestamp: Date.now()
        };

        const deployEvent: GameEvent = {
            id: `deploy_${eventData.carduid}_${Date.now()}`,
            type: EventType.DEPLOY_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId: eventData.playerId,
            data: eventDataObject,             // Pass eventDataObject directly
            timestamp: Date.now()
        };

        console.log(`🚀 Created Deploy event: ${deployEvent.id} with ${deployEffects.length} effects`);
        return deployEvent;
    }

    // ============ UTILITY METHODS ============
    
    /**
     * Generate unique event ID with prefix
     */
    static generateEventId(prefix: string, suffix?: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return suffix ? `${prefix}_${timestamp}_${suffix}` : `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Create base event structure with common fields
     */
    static createBaseEvent(
        type: EventType,
        playerId: string,
        data: any,
        options: {
            id?: string;
            status?: EventStatus;
            priority?: EventPriority;
        } = {}
    ): GameEvent {
        return {
            id: options.id || this.generateEventId(type.toLowerCase()),
            type: type,
            status: options.status || EventStatus.DECLARED,
            priority: options.priority || EventPriority.NORMAL,
            playerId: playerId,
            data: data,
            timestamp: Date.now()
        };
    }
}
