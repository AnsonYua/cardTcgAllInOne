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

export interface BaseGameEvent<TData = unknown> {
    id: string;
    type: EventType;
    status: EventStatus;
    priority: EventPriority;
    sourceId?: string;
    playerId: string;
    timestamp: number;
    data: TData;
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

export interface ChooseFirstPlayerEventData {
    playerId: string;
    gameId: string;
    chosenFirstPlayerId: string;
}

export interface ChooseFirstPlayerEvent extends BaseGameEvent<ChooseFirstPlayerEventData> {
    type: EventType.CHOOSE_FIRST_PLAYER;
}

export interface ConfirmRedrawEventData {
    playerId: string;
    gameId: string;
    isRedraw: boolean;
}

export interface ConfirmRedrawEvent extends BaseGameEvent<ConfirmRedrawEventData> {
    type: EventType.CONFIRM_REDRAW;
}

export interface PowerBoostEvent extends BaseGameEvent {
    type: EventType.RESOURCE_GAINED;
    data: {
        carduid: string;        // CHANGED: Use carduid instead of cardId
        value: number;
        playerId: string;
    };
}

export interface GameplayBeginsEventData {
    actionId?: string;
    description?: string;
    affectedPlayers?: string[];
    [key: string]: unknown;
}

export interface GameplayBeginsEvent extends BaseGameEvent<GameplayBeginsEventData> {
    type: EventType.GAMEPLAY_BEGINS;
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

export interface PlayCardEventData {
    gameId?: string;
    carduid: string;
    playAs: string;
    targetUnit?: string;
    fromBurst?: boolean;
    slotName?: string;
    cardPlayNotificationId?: string;
    [key: string]: unknown;
}

export interface PlayCardEvent extends BaseGameEvent<PlayCardEventData> {
    type: EventType.PLAY_CARD;
}

export interface ActionStepPostPlayEventData {
    actingPlayerId: string;
}

export interface ActionStepPostPlayEvent extends BaseGameEvent<ActionStepPostPlayEventData> {
    type: EventType.ACTION_STEP_POST_PLAY;
}

export interface TargetFilters {
    level?: string;
    hp?: string;
    status?: string;
    traits?: string[];
    zone?: string[];
    controller?: string;
    [key: string]: unknown;
}

export type TargetScope = 'self' | 'opponent' | 'any' | string;

export type TargetType = 'unit' | 'pilot' | 'card' | 'player' | string;

export interface EffectTargetConfig {
    type?: TargetType;
    scope?: TargetScope;
    count?: number;
    filters?: TargetFilters;
    zone?: string[];
    selection?: {
        type: string;
        tieBreaker?: string;
        [key: string]: unknown;
    };
}

export interface TargetReference {
    carduid: string;
    zone: string;
    playerId: string;
    cardData?: Record<string, unknown>;
}

export interface EffectTiming {
    windows?: string[];
    duration?: string;
    actionTurn?: string;
    endOnSourceDestroyed?: boolean;
}

export type EffectCondition = string | Record<string, unknown>;

export type SourceConditionScope = 'source' | 'player' | 'game';

export interface EffectSourceConditionObject {
    type: string;
    scope?: SourceConditionScope;
    value?: unknown;
    [key: string]: unknown;
}

export type EffectSourceCondition = string | EffectSourceConditionObject;

export interface EffectDefinition {
    effectId: string;
    type?: string;
    trigger?: string;
    optional?: boolean;
    target?: EffectTargetConfig;
    action?: string;
    cost?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    timing?: EffectTiming;
    conditions?: EffectCondition[];
    description?: string | string[];
    sourceConditions?: EffectSourceCondition[];
}

export interface DeployEffectEventData {
    carduid: string;
    effects: EffectDefinition[];
    cardPlayNotificationId?: string;
}

export interface DeployEffectEvent extends BaseGameEvent<DeployEffectEventData> {
    type: EventType.DEPLOY_EFFECT_TRIGGERED;
}

export interface PairingEffectDefinition extends EffectDefinition {
    pairedSlot: string;
    sourceCarduid: string;
}

export interface PairingEffectEventData {
    carduid: string;
    effects: PairingEffectDefinition[];
}

export interface PairingEffectEvent extends BaseGameEvent<PairingEffectEventData> {
    type: EventType.PAIRING_EFFECT_TRIGGERED;
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

export interface RepairEffectEventData {
    carduid: string;
    healAmount: number;
}

export interface RepairEffectEvent extends BaseGameEvent<RepairEffectEventData> {
    type: EventType.TRIGGER_HEALING;
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

export interface ErrorOccurredEventData {
    errorType: string;
    errorReason: string;
    playerId?: string;
    originalEventType?: EventType;
    originalEventId?: string;
    [key: string]: unknown;
}

export interface ErrorOccurredEvent extends BaseGameEvent<ErrorOccurredEventData> {
    type: EventType.ERROR_OCCURRED;
}

export interface PlayerActionEventData {
    playerId: string;
    actionType: string;
    fromBurst?: boolean;
    [key: string]: unknown;
}

export interface PlayerActionEvent extends BaseGameEvent<PlayerActionEventData> {
    type: EventType.PLAYER_ACTION;
}

export interface EndTurnEvent extends BaseGameEvent {
    type: EventType.END_TURN;
    data: {
        playerId: string;
        currentTurnNumber: number;
        timestamp: number;
        fromBurst?: boolean;
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
        carduid?: string;
        previousPlayerId?: string | null;
    };
}

export interface TargetChoiceSelection {
    carduid: string;
    zone: string;
    playerId: string;
}

export interface TargetChoiceEventData {
    choiceId: string;
    userDecisionMade: boolean;
    sourceCarduid: string;
    effect: EffectDefinition;
    availableTargets: TargetReference[];
    selectedTarget?: TargetChoiceSelection;
    selectedTargets?: TargetChoiceSelection[];
    cardPlayNotificationId?: string;
}

export interface TargetChoiceEvent extends BaseGameEvent<TargetChoiceEventData> {
    type: EventType.TARGET_CHOICE;
}

export interface BlockerChoiceEventData {
    originalAttackEvent: PlayerActionEvent;
    availableTargets: TargetReference[];
    selectedTarget?: TargetReference;
    blockingPlayerId: string;
    userDecisionMade: boolean;
    choiceId?: string;
    userDecision?: 'BLOCK' | 'DECLINE';
}

export interface BlockerUnit {
    carduid: string;
    effect: EffectDefinition;
}

export interface BlockerChoiceEvent extends BaseGameEvent<BlockerChoiceEventData> {
    type: EventType.BLOCKER_CHOICE;
}

export type GameEvent = 
    | AcknowledgeEventsEvent
    | PlayCardEvent
    | DeployEffectEvent
    | RepairEffectEvent
    | PairingEffectEvent
    | PowerBoostEvent
    | ConfirmRedrawEvent
    | ChooseFirstPlayerEvent
    | GameplayBeginsEvent
    | ErrorOccurredEvent
    | PlayerActionEvent
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
    | BaseGameEvent<unknown>
    | NextPlayerTurnEvent
    | ShieldCardAttackedEvent
    | BurstEffectChoiceEvent
    | TargetChoiceEvent
    | BlockerChoiceEvent;
