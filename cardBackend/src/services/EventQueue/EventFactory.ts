// src/services/EventQueue/EventFactory.ts
// Centralized event creation helpers (thin facade over smaller factory modules)

import type { EventType } from '../../models/GameEnums';
import type {
    AbilityActivatedEvent,
    AbilityTriggeredEvent,
    AcknowledgeEventsEvent,
    ActionStepPostPlayEvent,
    BaseGameEvent,
    BlockerChoiceEvent,
    BurstEffectChoiceEvent,
    CardEntersPlayEvent,
    DeployEffectEvent,
    EffectDefinition,
    EndTurnEvent,
    JoinGameEvent,
    OptionChoiceEvent,
    OptionChoiceOption,
    PairingEffectDefinition,
    PairingEffectEvent,
    EffectDrawTriggeredEvent,
    ExResourcePlacedTriggeredEvent,
    ShieldAreaCardDamagedTriggeredEvent,
    PlayCardEvent,
    PlayCardEventData,
    PlayerActionEvent,
    PlayerActionEventData,
    ShieldCardAttackedEvent,
    StartGameEvent,
    StepBeginEvent,
    TargetChoiceEvent,
    TargetReference,
    TokenChoiceEvent,
    TokenChoiceOption,
    TurnEndEvent,
    TurnStartEvent,
    EventPriority,
    EventStatus
} from './interfaces/GameEvent';
import {
    createTurnStartEvent,
    createTurnEndEvent,
    createActionStepPostPlayEvent,
    createPlayerActionEvent,
    createStepBeginEvent,
    createEndTurnEvent,
    createAcknowledgeEventsEvent
} from './factories/GameFlowEventFactories';
import { createStartGameEvent, createJoinGameEvent } from './factories/GameLifecycleEventFactories';
import { createAbilityTriggeredEvent, createAbilityActivatedEvent } from './factories/AbilityEventFactories';
import {
    createPlayCardEvent,
    createCardEntersPlayEvent,
    createBurstDeployEvent
} from './factories/CardLifecycleEventFactories';
import {
    createBurstEffectChoiceEvent,
    createTargetChoiceEvent,
    createTokenChoiceEvent,
    createOptionChoiceEvent,
    createBlockerChoiceEvent
} from './factories/ChoiceEventFactories';
import { createDeployEffectEvent, createEffectDrawTriggeredEvent, createExResourcePlacedTriggeredEvent, createPairingEffectEvent, createShieldAreaCardDamagedTriggeredEvent, createShieldCardAttackedEvent } from './factories/EffectEventFactories';
import { generateEventId, createBaseEvent } from './factories/EventIdUtils';

export class EventFactory {
    static createTurnStartEvent(playerId: string, turnNumber: number, phase: string): TurnStartEvent {
        return createTurnStartEvent(playerId, turnNumber, phase);
    }

    static createTurnEndEvent(playerId: string, turnNumber: number, nextPlayerId: string): TurnEndEvent {
        return createTurnEndEvent(playerId, turnNumber, nextPlayerId);
    }

    static createPlayCardEvent(
        playerId: string,
        gameId: string | undefined,
        carduid: string,
        playAs: string,
        targetUnit?: string,
        extras: Partial<PlayCardEventData> = {}
    ): PlayCardEvent {
        return createPlayCardEvent(playerId, gameId, carduid, playAs, targetUnit, extras);
    }

    static createActionStepPostPlayEvent(playerId: string): ActionStepPostPlayEvent {
        return createActionStepPostPlayEvent(playerId);
    }

    static createPlayerActionEvent(
        playerId: string,
        actionType: string,
        extras: Partial<PlayerActionEventData> = {}
    ): PlayerActionEvent {
        return createPlayerActionEvent(playerId, actionType, extras);
    }

    static createStepBeginEvent(step: string, playerId: string, allowsResponses: boolean = true): StepBeginEvent {
        return createStepBeginEvent(step, playerId, allowsResponses);
    }

    static createCardEntersPlayEvent(
        carduid: string,
        zone: string,
        playerId: string,
        wasFromHand: boolean = true,
        faceDown: boolean = false
    ): CardEntersPlayEvent {
        return createCardEntersPlayEvent(carduid, zone, playerId, wasFromHand, faceDown);
    }

    static createAbilityTriggeredEvent(
        abilityId: string,
        sourceCarduid: string,
        playerId: string,
        triggerCondition: string,
        isOptional: boolean = false,
        targets?: string[]
    ): AbilityTriggeredEvent {
        return createAbilityTriggeredEvent(abilityId, sourceCarduid, playerId, triggerCondition, isOptional, targets);
    }

    static createAbilityActivatedEvent(
        abilityId: string,
        sourceCarduid: string,
        playerId: string,
        cost?: number,
        targets?: string[]
    ): AbilityActivatedEvent {
        return createAbilityActivatedEvent(abilityId, sourceCarduid, playerId, cost, targets);
    }

    static createStartGameEvent(playerId: string, gameId: string): StartGameEvent {
        return createStartGameEvent(playerId, gameId);
    }

    static createJoinGameEvent(playerId: string, gameId: string): JoinGameEvent {
        return createJoinGameEvent(playerId, gameId);
    }

    static createEndTurnEvent(playerId: string, currentTurnNumber: number): EndTurnEvent {
        return createEndTurnEvent(playerId, currentTurnNumber);
    }

    static createAcknowledgeEventsEvent(playerId: string, eventIds: string[]): AcknowledgeEventsEvent {
        return createAcknowledgeEventsEvent(playerId, eventIds);
    }

    static createShieldCardAttackedEvent(
        defendingPlayerId: string,
        attackingPlayerId: string,
        attackerSlot: string,
        shieldCards: Array<{ carduid: string; cardData: any }>,
        attackPower: number
    ): ShieldCardAttackedEvent {
        return createShieldCardAttackedEvent(defendingPlayerId, attackingPlayerId, attackerSlot, shieldCards, attackPower);
    }

    static createBurstEffectChoiceEvent(playerId: string, cards: Array<any>): BurstEffectChoiceEvent {
        return createBurstEffectChoiceEvent(playerId, cards);
    }

    static createTargetChoiceEvent(params: {
        playerId: string;
        sourceCarduid: string;
        effect: EffectDefinition;
        availableTargets: TargetReference[];
    }): TargetChoiceEvent {
        return createTargetChoiceEvent(params);
    }

    static createTokenChoiceEvent(params: {
        playerId: string;
        sourceCarduid: string;
        effect: EffectDefinition;
        availableChoices: TokenChoiceOption[];
    }): TokenChoiceEvent {
        return createTokenChoiceEvent(params);
    }

    static createOptionChoiceEvent(params: {
        playerId: string;
        sourceCarduid: string;
        effect: EffectDefinition;
        availableOptions: OptionChoiceOption[];
        context?: Record<string, unknown>;
    }): OptionChoiceEvent {
        return createOptionChoiceEvent(params);
    }

    static createBlockerChoiceEvent(params: {
        blockingPlayerId: string;
        originalAttackEvent: PlayerActionEvent;
        availableTargets: TargetReference[];
    }): BlockerChoiceEvent {
        return createBlockerChoiceEvent(params);
    }

    static createDeployEffectEvent(
        playerId: string,
        carduid: string,
        deployEffects: EffectDefinition[],
        cardPlayNotificationId?: string
    ): DeployEffectEvent {
        return createDeployEffectEvent(playerId, carduid, deployEffects, cardPlayNotificationId);
    }

    static createPairingEffectEvent(
        playerId: string,
        carduid: string,
        pairingEffects: PairingEffectDefinition[]
    ): PairingEffectEvent {
        return createPairingEffectEvent(playerId, carduid, pairingEffects);
    }

    static createEffectDrawTriggeredEvent(params: {
        playerId: string;
        drawnPlayerId: string;
        drawnCarduids: string[];
        drawContext?: string;
        sourceCarduid?: string;
    }): EffectDrawTriggeredEvent {
        return createEffectDrawTriggeredEvent(params.playerId, {
            drawnPlayerId: params.drawnPlayerId,
            drawnCarduids: params.drawnCarduids,
            drawContext: params.drawContext,
            sourceCarduid: params.sourceCarduid
        });
    }

    static createExResourcePlacedTriggeredEvent(params: {
        playerId: string;
        placedPlayerId: string;
        placedCarduids: string[];
        sourceCarduid?: string;
        reason?: string;
    }): ExResourcePlacedTriggeredEvent {
        return createExResourcePlacedTriggeredEvent(params.playerId, {
            placedPlayerId: params.placedPlayerId,
            placedCarduids: params.placedCarduids,
            sourceCarduid: params.sourceCarduid,
            reason: params.reason
        });
    }

    static createShieldAreaCardDamagedTriggeredEvent(params: {
        playerId: string;
        attackingPlayerId: string;
        attackerSlot: string;
        defendingPlayerId: string;
        defenseArea: 'shield' | 'base';
        damagedCarduid?: string;
        damageSource: 'battle';
        sourceCarduid?: string;
    }): ShieldAreaCardDamagedTriggeredEvent {
        return createShieldAreaCardDamagedTriggeredEvent(params.playerId, {
            attackingPlayerId: params.attackingPlayerId,
            attackerSlot: params.attackerSlot,
            defendingPlayerId: params.defendingPlayerId,
            defenseArea: params.defenseArea,
            damagedCarduid: params.damagedCarduid,
            damageSource: params.damageSource,
            sourceCarduid: params.sourceCarduid
        });
    }

    static createBurstDeployEvent(playerId: string, carduid: string, cardData: any, burstEffect: any): PlayCardEvent {
        return createBurstDeployEvent(playerId, carduid, cardData, burstEffect);
    }

    static generateEventId(prefix: string, suffix?: string): string {
        return generateEventId(prefix, suffix);
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
        return createBaseEvent(type, playerId, data, options);
    }
}
