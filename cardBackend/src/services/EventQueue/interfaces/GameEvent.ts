// Event system interfaces for trading card game

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
    type: string;
    status: EventStatus;
    priority: EventPriority;
    sourceId?: string;
    playerId?: string;
    timestamp: number;
    data: any;
    reactionsPolled?: boolean;
}

export interface CardPlayedEvent extends BaseGameEvent {
    type: 'CARD_PLAYED';
    data: {
        cardId: string;
        cardUid: string;
        zone: string;
        isFaceDown: boolean;
        playerId: string;
    };
}

export interface PhaseChangeEvent extends BaseGameEvent {
    type: 'PHASE_CHANGE';
    data: {
        fromPhase: string;
        toPhase: string;
        reason: string;
    };
}

export interface PlayerChoiceEvent extends BaseGameEvent {
    type: 'PLAYER_CHOICE';
    data: {
        selectionId: string;
        choices: string[];
        playerId: string;
    };
}

export interface PowerBoostEvent extends BaseGameEvent {
    type: 'POWER_BOOST';
    data: {
        cardId: string;
        value: number;
        playerId: string;
    };
}

// ============ LOGICAL GAME FLOW EVENTS ============

export interface TurnStartEvent extends BaseGameEvent {
    type: 'TURN_START';
    data: {
        playerId: string;
        turnNumber: number;
        phase: string;
    };
}

export interface TurnEndEvent extends BaseGameEvent {
    type: 'TURN_END';
    data: {
        playerId: string;
        turnNumber: number;
        nextPlayerId: string;
    };
}

export interface StepBeginEvent extends BaseGameEvent {
    type: 'STEP_BEGIN';
    data: {
        step: string;
        playerId: string;
        allowsResponses: boolean;
    };
}

export interface StepEndEvent extends BaseGameEvent {
    type: 'STEP_END';
    data: {
        step: string;
        playerId: string;
    };
}

// ============ CARD LIFECYCLE EVENTS ============

export interface CardEntersPlayEvent extends BaseGameEvent {
    type: 'CARD_ENTERS_PLAY';
    data: {
        cardId: string;
        cardUid: string;
        zone: string;
        playerId: string;
        wasFromHand: boolean;
        faceDown: boolean;
    };
}

export interface CardLeavesPlayEvent extends BaseGameEvent {
    type: 'CARD_LEAVES_PLAY';
    data: {
        cardId: string;
        cardUid: string;
        fromZone: string;
        toZone: string;
        playerId: string;
        reason: string;
    };
}

export interface CardDestroyedEvent extends BaseGameEvent {
    type: 'CARD_DESTROYED';
    data: {
        cardId: string;
        cardUid: string;
        zone: string;
        playerId: string;
        destroyedBy?: string;
    };
}

export interface CardMovedEvent extends BaseGameEvent {
    type: 'CARD_MOVED';
    data: {
        cardId: string;
        cardUid: string;
        fromZone: string;
        toZone: string;
        playerId: string;
    };
}

// ============ RESOURCE & ENERGY EVENTS ============

export interface EnergyTappedEvent extends BaseGameEvent {
    type: 'ENERGY_TAPPED';
    data: {
        cardId: string;
        cardUid: string;
        playerId: string;
        energyAmount: number;
    };
}

export interface EnergyUntappedEvent extends BaseGameEvent {
    type: 'ENERGY_UNTAPPED';
    data: {
        cardId: string;
        cardUid: string;
        playerId: string;
    };
}

export interface CostPaidEvent extends BaseGameEvent {
    type: 'COST_PAID';
    data: {
        cardId: string;
        cost: number;
        paymentCards: string[];
        playerId: string;
    };
}

// ============ TRIGGERED ABILITY EVENTS ============

export interface AbilityTriggeredEvent extends BaseGameEvent {
    type: 'ABILITY_TRIGGERED';
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
    type: 'ABILITY_ACTIVATED';
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
    type: 'ABILITY_RESOLVED';
    data: {
        abilityId: string;
        sourceCardId: string;
        effects: any[];
        playerId: string;
    };
}

// ============ COMBAT EVENTS ============

export interface AttackDeclaredEvent extends BaseGameEvent {
    type: 'ATTACK_DECLARED';
    data: {
        attackerId: string;
        attackerUid: string;
        targetId?: string;
        targetUid?: string;
        playerId: string;
    };
}

export interface DamageDealtEvent extends BaseGameEvent {
    type: 'DAMAGE_DEALT';
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
    type: 'STATE_BASED_ACTION';
    data: {
        action: string;
        affectedCards: string[];
        reason: string;
    };
}

export type GameEvent = 
    | CardPlayedEvent 
    | PhaseChangeEvent 
    | PlayerChoiceEvent 
    | PowerBoostEvent
    | TurnStartEvent
    | TurnEndEvent 
    | StepBeginEvent
    | StepEndEvent
    | CardEntersPlayEvent
    | CardLeavesPlayEvent
    | CardDestroyedEvent
    | CardMovedEvent
    | EnergyTappedEvent
    | EnergyUntappedEvent
    | CostPaidEvent
    | AbilityTriggeredEvent
    | AbilityActivatedEvent
    | AbilityResolvedEvent
    | AttackDeclaredEvent
    | DamageDealtEvent
    | StateBasedActionEvent
    | BaseGameEvent;

export class EventFactory {
    private static eventIdCounter = 0;
    
    static createCardPlayedEvent(
        cardId: string, 
        cardUid: string, 
        zone: string, 
        playerId: string, 
        isFaceDown: boolean = false
    ): CardPlayedEvent {
        return {
            id: `event_${++this.eventIdCounter}_${Date.now()}`,
            type: 'CARD_PLAYED',
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: cardId,
            playerId,
            timestamp: Date.now(),
            data: { cardId, cardUid, zone, isFaceDown, playerId }
        };
    }
    
    static createChoiceResolvedEvent(
        selectionId: string,
        choices: string[],
        playerId: string
    ): BaseGameEvent {
        return {
            id: `choice_resolved_${++this.eventIdCounter}_${Date.now()}`,
            type: 'CHOICE_RESOLVED',
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
            type: 'PHASE_CHANGE',
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
            type: 'PLAYER_CHOICE',
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
            type: 'TURN_START',
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
            type: 'TURN_END',
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
            type: 'STEP_BEGIN',
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
            type: 'CARD_ENTERS_PLAY',
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: cardId,
            playerId,
            timestamp: Date.now(),
            data: { cardId, cardUid, zone, playerId, wasFromHand, faceDown }
        };
    }
    
    static createCardDestroyedEvent(
        cardId: string,
        cardUid: string,
        zone: string,
        playerId: string,
        destroyedBy?: string
    ): CardDestroyedEvent {
        return {
            id: `card_destroyed_${++this.eventIdCounter}_${Date.now()}`,
            type: 'CARD_DESTROYED',
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            sourceId: cardId,
            playerId,
            timestamp: Date.now(),
            data: { cardId, cardUid, zone, playerId, destroyedBy }
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
            type: 'ABILITY_TRIGGERED',
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
            type: 'ABILITY_ACTIVATED',
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
            type: 'ENERGY_TAPPED',
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: cardId,
            playerId,
            timestamp: Date.now(),
            data: { cardId, cardUid, playerId, energyAmount }
        };
    }
}