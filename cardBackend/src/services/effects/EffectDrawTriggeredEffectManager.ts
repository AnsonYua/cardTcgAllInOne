// src/services/effects/EffectDrawTriggeredEffectManager.ts
// Handles "When you draw with an effect" triggers (EFFECT_DRAW) for in-play cards.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDrawTriggeredEvent } from '../EventQueue/interfaces/GameEvent';
import { InPlayTriggeredEffectManager } from './InPlayTriggeredEffectManager';

export class EffectDrawTriggeredEffectManager {
    static executeEffectDrawTriggeredEvent(
        event: EffectDrawTriggeredEvent,
        gameEnv: GameEnvironment
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const drawingPlayerId = event.data.drawnPlayerId || event.playerId;
        return InPlayTriggeredEffectManager.processForPlayer({
            gameEnv,
            playerId: drawingPlayerId,
            trigger: 'EFFECT_DRAW',
            fallbackEffectId: 'effect_draw_triggered_effect'
        });
    }
}
