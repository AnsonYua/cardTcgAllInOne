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


export interface PhaseChangeEvent extends BaseGameEvent {
    type: EventType.PHASE_ADVANCE;
    data: {
        fromPhase: string;
        toPhase: string;
        reason: string;
    };
}

export interface PlayerChoiceEvent extends BaseGameEvent {
    type: EventType.PLAYER_CHOICE_REQUIRED;
    data: {
        selectionId: string;
        choices: string[];
        playerId: string;
    };
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
        cardId: string;
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
        cardId: string;
        cardUid: string;
        zone: string;
        playerId: string;
        wasFromHand: boolean;
        faceDown: boolean;
    };
}




// ============ RESOURCE & ENERGY EVENTS ============

export interface EnergyTappedEvent extends BaseGameEvent {
    type: EventType.ENERGY_TAPPED;
    data: {
        cardId: string;
        cardUid: string;
        playerId: string;
        energyAmount: number;
    };
}

export interface EnergyUntappedEvent extends BaseGameEvent {
    type: EventType.ENERGY_TAPPED;
    data: {
        cardId: string;
        cardUid: string;
        playerId: string;
    };
}

export interface CostPaidEvent extends BaseGameEvent {
    type: EventType.RESOURCE_GAINED;
    data: {
        cardId: string;
        cost: number;
        paymentCards: string[];
        playerId: string;
    };
}

// ============ TRIGGERED ABILITY EVENTS ============

export interface AbilityTriggeredEvent extends BaseGameEvent {
    type: EventType.CARD_EFFECT_TRIGGERED;
    data: {
        abilityId: string;
        sourceCardId: string;
        sourceCardUid: string;
        playerId: string;
        triggerCondition: string;
        isOptional: boolean;
        targets?: string[];
    };
}

export interface AbilityActivatedEvent extends BaseGameEvent {
    type: EventType.CARD_EFFECT_TRIGGERED;
    data: {
        abilityId: string;
        sourceCardId: string;
        sourceCardUid: string;
        playerId: string;
        cost?: number;
        targets?: string[];
    };
}

export interface AbilityResolvedEvent extends BaseGameEvent {
    type: EventType.CARD_EFFECT_TRIGGERED;
    data: {
        abilityId: string;
        sourceCardId: string;
        effects: any[];
        playerId: string;
    };
}

// ============ COMBAT EVENTS ============

export interface AttackDeclaredEvent extends BaseGameEvent {
    type: EventType.CARD_EFFECT_TRIGGERED;
    data: {
        attackerId: string;
        attackerUid: string;
        targetId?: string;
        targetUid?: string;
        playerId: string;
    };
}

export interface DamageDealtEvent extends BaseGameEvent {
    type: EventType.CARD_EFFECT_TRIGGERED;
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

export interface CardsUnrestEvent extends BaseGameEvent {
    type: EventType.CARDS_UNREST;
    data: {
        playerId: string;
        affectedCards: string[];
        cardTypes: string[];
    };
}

export interface AcknowledgeEventsEvent extends BaseGameEvent {
    type: EventType.ACKNOWLEDGE_EVENTS;
    data: {
        playerId: string;
        eventIds: string[];
    };
}

export type GameEvent = 
    | PhaseChangeEvent 
    | PlayerChoiceEvent 
    | PowerBoostEvent
    | TurnStartEvent
    | TurnEndEvent 
    | StepBeginEvent
    | StepEndEvent
    | CardEntersPlayEvent
    | EnergyTappedEvent
    | EnergyUntappedEvent
    | CostPaidEvent
    | AbilityTriggeredEvent
    | AbilityActivatedEvent
    | AbilityResolvedEvent
    | AttackDeclaredEvent
    | DamageDealtEvent
    | StateBasedActionEvent
    | EndTurnEvent
    | CardsUnrestEvent
    | AcknowledgeEventsEvent
    | StartGameEvent
    | JoinGameEvent
    | BaseGameEvent
    | NextPlayerTurnEvent;

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
    
    static createPhaseChangeEvent(
        fromPhase: string,
        toPhase: string,
        reason: string
    ): PhaseChangeEvent {
        return {
            id: `phase_change_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.PHASE_ADVANCE,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            timestamp: Date.now(),
            data: { fromPhase, toPhase, reason }
        };
    }
    
    static createPlayerChoiceEvent(
        selectionId: string,
        choices: string[],
        playerId: string
    ): PlayerChoiceEvent {
        return {
            id: `player_choice_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.PLAYER_CHOICE_REQUIRED,
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
        cardId: string,
        cardUid: string,
        zone: string,
        playerId: string,
        wasFromHand: boolean = true,
        faceDown: boolean = false
    ): CardEntersPlayEvent {
        return {
            id: `card_enters_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.CARD_ENTERS_PLAY,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: cardId,
            playerId,
            timestamp: Date.now(),
            data: { cardId, cardUid, zone, playerId, wasFromHand, faceDown }
        };
    }
    
    
    // ============ ABILITY EVENT FACTORIES ============
    
    static createAbilityTriggeredEvent(
        abilityId: string,
        sourceCardId: string,
        sourceCardUid: string,
        playerId: string,
        triggerCondition: string,
        isOptional: boolean = false,
        targets?: string[]
    ): AbilityTriggeredEvent {
        return {
            id: `ability_triggered_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.CARD_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            sourceId: sourceCardId,
            playerId,
            timestamp: Date.now(),
            data: { abilityId, sourceCardId, sourceCardUid, playerId, triggerCondition, isOptional, targets }
        };
    }
    
    static createAbilityActivatedEvent(
        abilityId: string,
        sourceCardId: string,
        sourceCardUid: string,
        playerId: string,
        cost?: number,
        targets?: string[]
    ): AbilityActivatedEvent {
        return {
            id: `ability_activated_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.CARD_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: sourceCardId,
            playerId,
            timestamp: Date.now(),
            data: { abilityId, sourceCardId, sourceCardUid, playerId, cost, targets }
        };
    }
    
    // ============ RESOURCE EVENT FACTORIES ============
    
    static createEnergyTappedEvent(
        cardId: string,
        cardUid: string,
        playerId: string,
        energyAmount: number
    ): EnergyTappedEvent {
        return {
            id: `energy_tapped_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.ENERGY_TAPPED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: cardId,
            playerId,
            timestamp: Date.now(),
            data: { cardId, cardUid, playerId, energyAmount }
        };
    }
    
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
    
    static createCardsUnrestEvent(playerId: string, affectedCards: string[]): CardsUnrestEvent {
        return {
            id: `cards_unrest_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.CARDS_UNREST,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId,
            timestamp: Date.now(),
            data: { playerId, affectedCards, cardTypes: ['energy', 'unit', 'base'] }
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
            data: { playerId, eventIds }
        };
    }
}