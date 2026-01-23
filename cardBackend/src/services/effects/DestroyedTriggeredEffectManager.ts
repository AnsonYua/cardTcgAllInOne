// src/services/effects/DestroyedTriggeredEffectManager.ts
// Handles "DESTROYED" triggered effects for cards that leave play due to destruction.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard, PilotZoneCard, BaseCard } from '../../models/CardSystem';
import { TriggeredEffectProcessor } from './TriggeredEffectProcessor';

type DestroyedCard = UnitZoneCard | PilotZoneCard | BaseCard;

export class DestroyedTriggeredEffectManager {
    static processDestroyedCard(
        gameEnv: GameEnvironment,
        destroyedPlayerId: string,
        destroyedCard: DestroyedCard
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        return TriggeredEffectProcessor.processForSourceCard(gameEnv, destroyedPlayerId, destroyedCard as any, {
            trigger: 'DESTROYED',
            expectedTriggers: ['DESTROYED'],
            fallbackEffectId: 'destroyed_effect',
            defaultTargetScope: 'self'
        });
    }
}
