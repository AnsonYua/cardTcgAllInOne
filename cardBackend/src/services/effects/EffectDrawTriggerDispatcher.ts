// src/services/effects/EffectDrawTriggerDispatcher.ts
// Centralized helper for "When you draw with an effect" triggers.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EventFactory } from '../EventQueue/EventFactory';
import { TriggerDispatchUtils } from './TriggerDispatchUtils';
import { GameNotificationManager } from '../GameNotificationManager';

export class EffectDrawTriggerDispatcher {
    static dispatchEffectDrawIfNeeded(params: {
        gameEnv: GameEnvironment;
        playerId: string;
        drawnCarduids: string[];
        requestedCount?: number;
        drawContext?: string;
        sourceCarduid?: string;
    }): void {
        const { gameEnv, playerId, drawnCarduids, requestedCount, drawContext, sourceCarduid } = params;

        const isEffectDraw = !!drawContext && drawContext !== 'turn_start';
        if (!isEffectDraw) {
            return;
        }

        if (drawnCarduids.length === 0) {
            // Emit a notification for effect draw attempts that resolve with 0 cards
            // (for example, drawing from an empty deck) so clients can still surface
            // that the effect tried to draw.
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'EFFECT_DRAW_TRIGGERED',
                {
                    playerId,
                    drawnPlayerId: playerId,
                    drawnCarduids: [],
                    count: 0,
                    requestedCount: typeof requestedCount === 'number' ? Math.max(0, requestedCount) : 0,
                    drawContext,
                    sourceCarduid,
                    drewAny: false,
                    reason: 'NO_CARDS_DRAWN',
                    timestamp: Date.now()
                },
                'normal'
            );
            return;
        }

        const triggerEvent = EventFactory.createEffectDrawTriggeredEvent({
            playerId,
            drawnPlayerId: playerId,
            drawnCarduids,
            drawContext,
            sourceCarduid
        });

        TriggerDispatchUtils.enqueueAndNotify({
            gameEnv,
            triggerEvent,
            notificationType: 'EFFECT_DRAW_TRIGGERED',
            payload: {
            playerId,
            drawnPlayerId: playerId,
            drawnCarduids,
            count: drawnCarduids.length,
            drawContext,
            sourceCarduid,
            timestamp: Date.now()
            }
        });
    }
}
