// src/services/effects/EffectDrawTriggerDispatcher.ts
// Centralized helper for "When you draw with an effect" triggers.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EventFactory } from '../EventQueue/EventFactory';
import { TriggerDispatchUtils } from './TriggerDispatchUtils';

export class EffectDrawTriggerDispatcher {
    static dispatchEffectDrawIfNeeded(params: {
        gameEnv: GameEnvironment;
        playerId: string;
        drawnCarduids: string[];
        drawContext?: string;
        sourceCarduid?: string;
    }): void {
        const { gameEnv, playerId, drawnCarduids, drawContext, sourceCarduid } = params;

        const isEffectDraw = !!drawContext && drawContext !== 'turn_start';
        if (!isEffectDraw || drawnCarduids.length === 0) {
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
