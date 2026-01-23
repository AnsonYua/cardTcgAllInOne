// src/services/CardEnteredPlayManager.ts
// Centralizes "after a card is placed into play" side-effects (deploy triggers, continuous effects refresh).

import { GameEnvironment } from '../models/GameEnvironment';
import { PlayCardEventData } from './EventQueue/interfaces/GameEvent';
import { DeployEffectManager } from './DeployEffectManager';
import { ContinuousEffectManager } from './ContinuousEffectManager';

export class CardEnteredPlayManager {
    static handleCardEnteredPlay(
        gameEnv: GameEnvironment,
        playerId: string,
        params: {
            carduid: string;
            playAs: string;
            slotName?: string;
            cardPlayNotificationId?: string;
        }
    ): { success: boolean; deployEffectsQueued: number; error?: string } {
        const eventData: PlayCardEventData = {
            carduid: params.carduid,
            playAs: params.playAs,
            ...(params.slotName ? { slotName: params.slotName } : {}),
            ...(params.cardPlayNotificationId ? { cardPlayNotificationId: params.cardPlayNotificationId } : {})
        };

        const deployResult = DeployEffectManager.checkAndQueueDeployEffects(eventData, playerId, gameEnv);
        if (!deployResult.success) {
            return {
                success: false,
                deployEffectsQueued: 0,
                error: deployResult.error || 'Failed to queue deploy effects'
            };
        }

        try {
            ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        } catch (error) {
            console.error('❌ Error processing continuous effects after card entered play:', error);
        }

        return {
            success: true,
            deployEffectsQueued: deployResult.effectsFound
        };
    }
}

