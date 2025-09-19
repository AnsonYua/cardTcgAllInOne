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
    type: EventType.TRIGGER_HEALING;
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
    type: EventType.TRIGGER_HEALING;
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
        playerId: string;
        eventIds: string[];
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
            cardUid: string;
            cardId: string;
            cardData: any;
        }>;
        attackPower: number;
    };
}

export interface BurstEffectChoiceEvent extends BaseGameEvent {
    type: EventType.BURST_EFFECT_CHOICE;
    data: {
        playerId: string;
        cardUid: string;
        cardId: string;
        cardData: any;
        burstEffect: {
            effectId: string;
            type: string;
            description: string;
        };
        choiceId: string;
        userDecisionMade: boolean;
        userDecision?: 'ACTIVATE' | 'DECLINE';
    };
}

export interface DeployTargetChoiceEvent extends BaseGameEvent {
    type: EventType.DEPLOY_TARGET_CHOICE;
    data: {
        playerId: string;           // Player making the choice
        sourceCardUid: string;      // Card with deploy effect
        sourceCardId: string;
        deployEffect: {
            effectId: string;
            description: string;
            target: any;            // Target filters (type: "unit", scope: "opponent", etc.)
            effect: any;            // Action to perform (action: "rest")
        };
        availableTargets: Array<{   // Valid targets based on filters (simplified references)
            cardUid: string;
            zone: string;
            playerId: string;
        }>;
        choiceId: string;
        userDecisionMade: boolean;
        selectedTarget?: {
            cardUid: string;
            zone: string;
            playerId: string;
        };
    };
}

export type GameEvent = 
    | PhaseChangeEvent 
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
    | AcknowledgeEventsEvent
    | StartGameEvent
    | JoinGameEvent
    | BaseGameEvent
    | NextPlayerTurnEvent
    | ShieldCardAttackedEvent
    | BurstEffectChoiceEvent
    | DeployTargetChoiceEvent;

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
            type: EventType.TRIGGER_HEALING,
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
            type: EventType.TRIGGER_HEALING,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: sourceCardId,
            playerId,
            timestamp: Date.now(),
            data: { abilityId, sourceCardId, sourceCardUid, playerId, cost, targets }
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
            data: { playerId, eventIds }
        };
    }
    
    // ============ SHIELD ATTACK EVENT FACTORIES ============
    
    static createShieldCardAttackedEvent(
        defendingPlayerId: string,
        attackingPlayerId: string,
        attackerSlot: string,
        shieldCards: Array<{ cardUid: string; cardId: string; cardData: any }>,
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
                shieldCards,
                attackPower
            }
        };
    }
    
    static createBurstEffectChoiceEvent(
        playerId: string,
        cardUid: string,
        cardId: string,
        cardData: any,
        burstEffect: { effectId: string; type: string; description: string }
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
                cardUid,
                cardId,
                cardData,
                burstEffect,
                choiceId: `burst_choice_${cardUid}_${Date.now()}`,
                userDecisionMade: false,
                userDecision: undefined
            }
        };
    }
    
    static createDeployTargetChoiceEvent(
        playerId: string,
        sourceCardUid: string,
        sourceCardId: string,
        deployEffect: any,
        availableTargets: any[]
    ): DeployTargetChoiceEvent {
        return {
            id: `deploy_target_choice_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.DEPLOY_TARGET_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: {
                playerId,
                sourceCardUid,
                sourceCardId,
                deployEffect,
                availableTargets,
                choiceId: `deploy_target_${sourceCardUid}_${Date.now()}`,
                userDecisionMade: false,
                selectedTarget: undefined
            }
        };
    }
    
    // ============ GAME-SPECIFIC EVENT FACTORIES (Moved from GameEventFactory.ts) ============
    
    /**
     * Create Pairing effect event for processing queue
     */
    static createPairingEffectEvent(eventData: any, pairingEffects: any[], placementResult: any): GameEvent {
        const pairingEvent: GameEvent = {
            id: `pairing_${eventData.cardUID}_${Date.now()}`,
            type: EventType.PAIRING_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId: eventData.playerId,
            data: {
                // Only include data actually used by PairingEffect.processPairingEffect
                playerId: eventData.playerId,
                effects: pairingEffects
            },
            timestamp: Date.now()
        };

        console.log(`🤝 Created Pairing event: ${pairingEvent.id} with ${pairingEffects.length} effects`);
        return pairingEvent;
    }

    /**
     * Create PLAY_CARD event for burst deploy effects
     */
    static createBurstDeployEvent(playerId: string, cardUid: string, cardData: any, burstEffect: any): GameEvent {
        // Determine playAs based on card type and burst effect
        let playAs = cardData.cardType;
        if (cardData.cardType === 'command' && burstEffect.effect?.action === 'designate_pilot') {
            playAs = 'pilot';
        }

        const playCardEvent: GameEvent = {
            id: `burst_deploy_${Date.now()}_${Math.random()}`,
            type: EventType.PLAY_CARD,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            timestamp: Date.now(),
            playerId: playerId,
            data: {
                playerId: playerId,
                cardUID: cardUid,
                cardId: cardData.id || cardData.cardId,
                cardData: cardData,
                playAs: playAs,
                fromBurst: true
            }
        };

        console.log(`🚀 Created burst deploy PLAY_CARD event: ${playCardEvent.id} (playAs: ${playAs})`);
        return playCardEvent;
    }

    /**
     * Create Deploy effect event for processing queue
     */
    static createDeployEffectEvent(eventData: any, deployEffects: any[]): GameEvent {
        const deployEvent: GameEvent = {
            id: `deploy_${eventData.cardUID}_${Date.now()}`,
            type: EventType.DEPLOY_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId: eventData.playerId,
            data: {
                cardId: eventData.cardId,
                cardUID: eventData.cardUID,
                cardData: eventData.cardData,
                playerId: eventData.playerId,
                zone: eventData.zone,
                effects: deployEffects,
                timestamp: Date.now()
            },
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