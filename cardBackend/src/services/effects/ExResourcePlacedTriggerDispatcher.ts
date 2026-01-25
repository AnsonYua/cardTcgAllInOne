// src/services/effects/ExResourcePlacedTriggerDispatcher.ts
// Centralized helper for "When you place an EX Resource" triggers (EX_RESOURCE_PLACED).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EventFactory } from '../EventQueue/EventFactory';
import { TriggerDispatchUtils } from './TriggerDispatchUtils';

export class ExResourcePlacedTriggerDispatcher {
    static dispatchIfNeeded(params: {
        gameEnv: GameEnvironment;
        playerId: string;
        placedCarduids: string[];
        sourceCarduid?: string;
        reason?: string;
    }): void {
        const { gameEnv, playerId, placedCarduids, sourceCarduid, reason } = params;

        if (!Array.isArray(placedCarduids) || placedCarduids.length === 0) {
            return;
        }

        const triggerEvent = EventFactory.createExResourcePlacedTriggeredEvent({
            playerId,
            placedPlayerId: playerId,
            placedCarduids,
            sourceCarduid,
            reason
        });

        TriggerDispatchUtils.enqueueAndNotify({
            gameEnv,
            triggerEvent,
            notificationType: 'EX_RESOURCE_PLACED',
            payload: {
            playerId,
            placedPlayerId: playerId,
            placedCarduids,
            count: placedCarduids.length,
            sourceCarduid,
            reason,
            timestamp: Date.now()
            }
        });
    }
}
