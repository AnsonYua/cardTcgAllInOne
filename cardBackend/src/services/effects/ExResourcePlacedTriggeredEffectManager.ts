// src/services/effects/ExResourcePlacedTriggeredEffectManager.ts
// Handles "When you place an EX Resource" triggers (EX_RESOURCE_PLACED) for in-play cards.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { ExResourcePlacedTriggeredEvent } from '../EventQueue/interfaces/GameEvent';
import { InPlayTriggeredEffectManager } from './InPlayTriggeredEffectManager';

export class ExResourcePlacedTriggeredEffectManager {
    static executeExResourcePlacedTriggeredEvent(
        event: ExResourcePlacedTriggeredEvent,
        gameEnv: GameEnvironment
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const placedPlayerId = event.data.placedPlayerId || event.playerId;
        return InPlayTriggeredEffectManager.processForPlayer({
            gameEnv,
            playerId: placedPlayerId,
            trigger: 'EX_RESOURCE_PLACED',
            fallbackEffectId: 'ex_resource_placed_triggered_effect'
        });
    }
}
