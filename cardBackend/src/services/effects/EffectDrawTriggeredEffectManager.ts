// src/services/effects/EffectDrawTriggeredEffectManager.ts
// Handles "When you draw with an effect" triggers (EFFECT_DRAW) for in-play cards.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { SLOT_ZONES } from '../../config/gameConstants';
import type { EffectDrawTriggeredEvent } from '../EventQueue/interfaces/GameEvent';
import { TriggeredEffectProcessor } from './TriggeredEffectProcessor';

export class EffectDrawTriggeredEffectManager {
    static executeEffectDrawTriggeredEvent(
        event: EffectDrawTriggeredEvent,
        gameEnv: GameEnvironment
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const drawingPlayerId = event.data.drawnPlayerId || event.playerId;
        const player = gameEnv.getPlayer(drawingPlayerId) || gameEnv.players[drawingPlayerId];
        if (!player?.zones) {
            return { success: true };
        }

        const sources: any[] = [];

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit) sources.push(slot.unit);
            if (slot?.pilot) sources.push(slot.pilot);
        }

        const bases = Array.isArray((player.zones as any).base) ? (player.zones as any).base : [];
        for (const base of bases) {
            if (base) sources.push(base);
        }

        for (const sourceCard of sources) {
            const processed = TriggeredEffectProcessor.processForSourceCard(gameEnv, drawingPlayerId, sourceCard, {
                trigger: 'EFFECT_DRAW',
                expectedTriggers: ['EFFECT_DRAW'],
                fallbackEffectId: 'effect_draw_triggered_effect',
                defaultTargetScope: 'self'
            });

            if (!processed.success) {
                return { success: false, error: processed.error };
            }

            if (processed.requiresSelection) {
                return { success: true, requiresSelection: true };
            }
        }

        return { success: true };
    }
}

