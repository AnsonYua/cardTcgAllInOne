// src/services/EventQueue/EventFactory.ts
// Centralized event creation helpers

import { EventType } from '../../models/GameEnums';
import {
    AbilityActivatedEvent,
    AbilityTriggeredEvent,
    AcknowledgeEventsEvent,
    ActionStepPostPlayEvent,
    BaseGameEvent,
    BlockerChoiceEvent,
    BlockerChoiceEventData,
    BurstEffectChoiceEvent,
    CardEntersPlayEvent,
    DeployEffectEvent,
    DeployEffectEventData,
    EffectDefinition,
    EndTurnEvent,
    EventPriority,
    EventStatus,
    PairingEffectDefinition,
    PairingEffectEvent,
    PairingEffectEventData,
    PlayCardEvent,
    PlayCardEventData,
    PlayerActionEvent,
    ShieldCardAttackedEvent,
    StartGameEvent,
    JoinGameEvent,
    StepBeginEvent,
    TargetChoiceEvent,
    TargetChoiceEventData,
    TargetReference,
    TokenChoiceOption,
    TokenChoiceEvent,
    OptionChoiceEvent,
    OptionChoiceOption,
    TurnEndEvent,
    TurnStartEvent
} from './interfaces/GameEvent';

export class EventFactory {
    private static eventIdCounter = 0;

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

    static createPlayCardEvent(
        playerId: string,
        gameId: string | undefined,
        carduid: string,
        playAs: string,
        targetUnit?: string,
        extras: Partial<PlayCardEventData> = {}
    ): PlayCardEvent {
        const sanitizedExtras: Partial<PlayCardEventData> = { ...extras };
        if ('playerId' in sanitizedExtras) {
            delete (sanitizedExtras as Record<string, unknown>).playerId;
        }

        const eventData: PlayCardEventData = {
            carduid,
            playAs,
            ...(typeof gameId === 'string' && gameId.length > 0 ? { gameId } : {}),
            ...(typeof targetUnit === 'string' ? { targetUnit } : {}),
            ...sanitizedExtras
        };

        return {
            id: `play_card_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.PLAY_CARD,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            timestamp: Date.now(),
            playerId,
            data: eventData
        };
    }

    static createActionStepPostPlayEvent(playerId: string): ActionStepPostPlayEvent {
        return {
            id: `action_step_post_play_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.ACTION_STEP_POST_PLAY,
            status: EventStatus.DECLARED,
            priority: EventPriority.LOW,
            timestamp: Date.now(),
            playerId,
            data: {
                actingPlayerId: playerId
            }
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
        carduid: string,
        zone: string,
        playerId: string,
        wasFromHand: boolean = true,
        faceDown: boolean = false
    ): CardEntersPlayEvent {
        const { getCardIdFromUid } = require('../../utils/CardUtils');
        const cardId = getCardIdFromUid(carduid);

        return {
            id: `card_enters_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.CARD_ENTERS_PLAY,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: cardId,
            playerId,
            timestamp: Date.now(),
            data: { carduid, zone, playerId, wasFromHand, faceDown }
        };
    }

    // ============ ABILITY EVENT FACTORIES ============

    static createAbilityTriggeredEvent(
        abilityId: string,
        sourceCarduid: string,
        playerId: string,
        triggerCondition: string,
        isOptional: boolean = false,
        targets?: string[]
    ): AbilityTriggeredEvent {
        const { getCardIdFromUid } = require('../../utils/CardUtils');
        const sourceCardId = getCardIdFromUid(sourceCarduid);

        return {
            id: `ability_triggered_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TRIGGER_HEALING,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            sourceId: sourceCardId,
            playerId,
            timestamp: Date.now(),
            data: { abilityId, sourceCardId, sourceCarduid, playerId, triggerCondition, isOptional, targets }
        };
    }

    static createAbilityActivatedEvent(
        abilityId: string,
        sourceCarduid: string,
        playerId: string,
        cost?: number,
        targets?: string[]
    ): AbilityActivatedEvent {
        const { getCardIdFromUid } = require('../../utils/CardUtils');
        const sourceCardId = getCardIdFromUid(sourceCarduid);

        return {
            id: `ability_activated_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TRIGGER_HEALING,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            sourceId: sourceCardId,
            playerId,
            timestamp: Date.now(),
            data: { abilityId, sourceCardId, sourceCarduid, playerId, cost, targets }
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
        shieldCards: Array<{ carduid: string; cardData: any }>,
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

    static createBurstEffectChoiceEvent(playerId: string, cards: Array<any>): BurstEffectChoiceEvent {
        const firstCarduid = cards?.[0]?.carduid;
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
                userDecision: undefined,
                carduid: firstCarduid
            }
        };
    }

    static createTargetChoiceEvent(params: {
        playerId: string;
        sourceCarduid: string;
        effect: EffectDefinition;
        availableTargets: TargetReference[];
    }): TargetChoiceEvent {
        const { playerId, sourceCarduid, effect, availableTargets } = params;
        const effectKey = effect?.effectId || effect?.action || 'effect';
        const eventData: TargetChoiceEventData = {
            choiceId: `target_choice_${effectKey}_${Date.now()}`,
            userDecisionMade: false,
            sourceCarduid,
            effect,
            availableTargets
        };

        return {
            id: `target_choice_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TARGET_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId,
            timestamp: Date.now(),
            data: eventData
        };
    }

    static createTokenChoiceEvent(params: {
        playerId: string;
        sourceCarduid: string;
        effect: EffectDefinition;
        availableChoices: TokenChoiceOption[];
    }): TokenChoiceEvent {
        const { playerId, sourceCarduid, effect, availableChoices } = params;
        const effectKey = effect?.effectId || effect?.action || 'effect';
        const eventData = {
            choiceId: `token_choice_${effectKey}_${Date.now()}`,
            userDecisionMade: false,
            sourceCarduid,
            effect,
            availableChoices
        };

        return {
            id: `token_choice_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.TOKEN_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId,
            timestamp: Date.now(),
            data: eventData
        };
    }

    static createOptionChoiceEvent(params: {
        playerId: string;
        sourceCarduid: string;
        effect: EffectDefinition;
        availableOptions: OptionChoiceOption[];
        context?: Record<string, unknown>;
    }): OptionChoiceEvent {
        const { playerId, sourceCarduid, effect, availableOptions, context } = params;
        const effectKey = effect?.effectId || effect?.action || 'effect';
        const eventData = {
            choiceId: `option_choice_${effectKey}_${Date.now()}`,
            userDecisionMade: false,
            sourceCarduid,
            effect,
            availableOptions,
            context
        };

        return {
            id: `option_choice_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.OPTION_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId,
            timestamp: Date.now(),
            data: eventData
        } as OptionChoiceEvent;
    }

    static createBlockerChoiceEvent(params: {
        blockingPlayerId: string;
        originalAttackEvent: PlayerActionEvent;
        availableTargets: TargetReference[];
    }): BlockerChoiceEvent {
        const { blockingPlayerId, originalAttackEvent, availableTargets } = params;
        const choiceId = `blocker_choice_${Date.now()}`;
        const eventData: BlockerChoiceEventData = {
            originalAttackEvent,
            availableTargets,
            blockingPlayerId,
            userDecisionMade: false,
            choiceId,
            userDecision: undefined
        };

        return {
            id: `blocker_choice_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.BLOCKER_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId: blockingPlayerId,
            timestamp: Date.now(),
            data: eventData
        };
    }

    static createDeployEffectEvent(
        playerId: string,
        carduid: string,
        deployEffects: EffectDefinition[],
        cardPlayNotificationId?: string
    ): DeployEffectEvent {
        const deployEffectEventData: DeployEffectEventData = {
            carduid,
            effects: deployEffects
        };
        if (cardPlayNotificationId) {
            deployEffectEventData.cardPlayNotificationId = cardPlayNotificationId;
        }

        return {
            id: `deploy_${++this.eventIdCounter}_${Date.now()}`,
            type: EventType.DEPLOY_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.HIGH,
            playerId,
            timestamp: Date.now(),
            data: deployEffectEventData
        };
    }

    // ============ GAME-SPECIFIC EVENT FACTORIES ============

    static createPairingEffectEvent(
        playerId: string,
        carduid: string,
        pairingEffects: PairingEffectDefinition[]
    ): PairingEffectEvent {
        const eventData: PairingEffectEventData = {
            carduid,
            effects: pairingEffects
        };

        const pairingEvent: PairingEffectEvent = {
            id: `pairing_${carduid}_${Date.now()}`,
            type: EventType.PAIRING_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId,
            data: eventData,
            timestamp: Date.now()
        };

        console.log(`🤝 Created Pairing event: ${pairingEvent.id} with ${pairingEffects.length} effects`);
        return pairingEvent;
    }

    static createBurstDeployEvent(playerId: string, carduid: string, cardData: any, burstEffect: any): PlayCardEvent {
        const { getCardIdFromUid } = require('../../utils/CardUtils');

        const playAs = (cardData.cardType === 'command' && burstEffect.action === 'designate_pilot')
            ? 'pilot'
            : cardData.cardType;

        const eventData: PlayCardEventData = {
            carduid,
            playAs,
            fromBurst: true,
            cardId: getCardIdFromUid(carduid),
            cardData
        };

        const playCardEvent: PlayCardEvent = {
            id: `burst_deploy_${Date.now()}_${Math.random()}`,
            type: EventType.PLAY_CARD,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            timestamp: Date.now(),
            playerId,
            data: eventData
        };

        console.log(`🚀 Created burst deploy PLAY_CARD event: ${playCardEvent.id} (playAs: ${playAs})`);
        return playCardEvent;
    }

    // ============ UTILITY METHODS ============

    static generateEventId(prefix: string, suffix?: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return suffix ? `${prefix}_${timestamp}_${suffix}` : `${prefix}_${timestamp}_${random}`;
    }

    static createBaseEvent<TData>(
        type: EventType,
        playerId: string,
        data: TData,
        options: {
            id?: string;
            status?: EventStatus;
            priority?: EventPriority;
        } = {}
    ): BaseGameEvent<TData> {
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
