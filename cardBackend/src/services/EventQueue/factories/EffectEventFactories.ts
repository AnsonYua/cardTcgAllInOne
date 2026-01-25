// src/services/EventQueue/factories/EffectEventFactories.ts

import { EventType } from '../../../models/GameEnums';
import {
    EventPriority,
    EventStatus,
    type DeployEffectEvent,
    type DeployEffectEventData,
    type EffectDrawTriggeredEvent,
    type EffectDrawTriggeredEventData,
    type ExResourcePlacedTriggeredEvent,
    type ExResourcePlacedTriggeredEventData,
    type ShieldAreaCardDamagedTriggeredEvent,
    type ShieldAreaCardDamagedTriggeredEventData,
    type EffectDefinition,
    type PairingEffectDefinition,
    type PairingEffectEvent,
    type PairingEffectEventData,
    type ShieldCardAttackedEvent
} from '../interfaces/GameEvent';
import { nextCounterEventId } from './EventIdUtils';

export const createDeployEffectEvent = (
    playerId: string,
    carduid: string,
    deployEffects: EffectDefinition[],
    cardPlayNotificationId?: string
): DeployEffectEvent => {
    const deployEffectEventData: DeployEffectEventData = {
        carduid,
        effects: deployEffects
    };
    if (cardPlayNotificationId) {
        deployEffectEventData.cardPlayNotificationId = cardPlayNotificationId;
    }

    return {
        id: nextCounterEventId('deploy'),
        type: EventType.DEPLOY_EFFECT_TRIGGERED,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data: deployEffectEventData
    };
};

export const createPairingEffectEvent = (
    playerId: string,
    carduid: string,
    pairingEffects: PairingEffectDefinition[]
): PairingEffectEvent => {
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
};

export const createEffectDrawTriggeredEvent = (
    playerId: string,
    data: EffectDrawTriggeredEventData
): EffectDrawTriggeredEvent => {
    return {
        id: nextCounterEventId('effect_draw'),
        type: EventType.TRIGGER_EFFECT_DRAW,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data
    };
};

export const createExResourcePlacedTriggeredEvent = (
    playerId: string,
    data: ExResourcePlacedTriggeredEventData
): ExResourcePlacedTriggeredEvent => {
    return {
        id: nextCounterEventId('ex_resource'),
        type: EventType.TRIGGER_EX_RESOURCE_PLACED,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data
    };
};

export const createShieldAreaCardDamagedTriggeredEvent = (
    playerId: string,
    data: ShieldAreaCardDamagedTriggeredEventData
): ShieldAreaCardDamagedTriggeredEvent => {
    return {
        id: nextCounterEventId('shield_area_damaged'),
        type: EventType.TRIGGER_SHIELD_AREA_CARD_DAMAGED,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        playerId,
        timestamp: Date.now(),
        data
    };
};

export const createShieldCardAttackedEvent = (
    defendingPlayerId: string,
    attackingPlayerId: string,
    attackerSlot: string,
    shieldCards: Array<{ carduid: string; cardData: any }>,
    attackPower: number
): ShieldCardAttackedEvent => {
    return {
        id: nextCounterEventId('shield_attacked'),
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
};
