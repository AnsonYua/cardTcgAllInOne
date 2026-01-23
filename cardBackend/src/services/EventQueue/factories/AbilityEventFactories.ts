// src/services/EventQueue/factories/AbilityEventFactories.ts

import { EventType } from '../../../models/GameEnums';
import { EventPriority, EventStatus, type AbilityActivatedEvent, type AbilityTriggeredEvent } from '../interfaces/GameEvent';
import { nextCounterEventId } from './EventIdUtils';

export const createAbilityTriggeredEvent = (
    abilityId: string,
    sourceCarduid: string,
    playerId: string,
    triggerCondition: string,
    isOptional: boolean = false,
    targets?: string[]
): AbilityTriggeredEvent => {
    const { getCardIdFromUid } = require('../../../utils/CardUtils');
    const sourceCardId = getCardIdFromUid(sourceCarduid);

    return {
        id: nextCounterEventId('ability_triggered'),
        type: EventType.TRIGGER_HEALING,
        status: EventStatus.DECLARED,
        priority: EventPriority.HIGH,
        sourceId: sourceCardId,
        playerId,
        timestamp: Date.now(),
        data: { abilityId, sourceCardId, sourceCarduid, playerId, triggerCondition, isOptional, targets }
    };
};

export const createAbilityActivatedEvent = (
    abilityId: string,
    sourceCarduid: string,
    playerId: string,
    cost?: number,
    targets?: string[]
): AbilityActivatedEvent => {
    const { getCardIdFromUid } = require('../../../utils/CardUtils');
    const sourceCardId = getCardIdFromUid(sourceCarduid);

    return {
        id: nextCounterEventId('ability_activated'),
        type: EventType.TRIGGER_HEALING,
        status: EventStatus.DECLARED,
        priority: EventPriority.NORMAL,
        sourceId: sourceCardId,
        playerId,
        timestamp: Date.now(),
        data: { abilityId, sourceCardId, sourceCarduid, playerId, cost, targets }
    };
};
