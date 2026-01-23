// src/services/EventQueue/factories/CardLifecycleEventFactories.ts

import { EventType } from '../../../models/GameEnums';
import {
    EventPriority,
    EventStatus,
    type CardEntersPlayEvent,
    type PlayCardEvent,
    type PlayCardEventData
} from '../interfaces/GameEvent';
import { nextCounterEventId } from './EventIdUtils';

export const createPlayCardEvent = (
    playerId: string,
    gameId: string | undefined,
    carduid: string,
    playAs: string,
    targetUnit?: string,
    extras: Partial<PlayCardEventData> = {}
): PlayCardEvent => {
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
        id: nextCounterEventId('play_card'),
        type: EventType.PLAY_CARD,
        status: EventStatus.DECLARED,
        priority: EventPriority.NORMAL,
        timestamp: Date.now(),
        playerId,
        data: eventData
    };
};

export const createCardEntersPlayEvent = (
    carduid: string,
    zone: string,
    playerId: string,
    wasFromHand: boolean = true,
    faceDown: boolean = false
): CardEntersPlayEvent => {
    const { getCardIdFromUid } = require('../../../utils/CardUtils');
    const cardId = getCardIdFromUid(carduid);

    return {
        id: nextCounterEventId('card_enters'),
        type: EventType.CARD_ENTERS_PLAY,
        status: EventStatus.DECLARED,
        priority: EventPriority.NORMAL,
        sourceId: cardId,
        playerId,
        timestamp: Date.now(),
        data: { carduid, zone, playerId, wasFromHand, faceDown }
    };
};

export const createBurstDeployEvent = (
    playerId: string,
    carduid: string,
    cardData: any,
    burstEffect: any
): PlayCardEvent => {
    const { getCardIdFromUid } = require('../../../utils/CardUtils');

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
};
