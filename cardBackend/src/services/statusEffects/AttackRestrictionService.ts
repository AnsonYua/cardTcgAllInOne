// src/services/statusEffects/AttackRestrictionService.ts
// Centralizes applying attack restrictions + notifying the frontend.

import { GameEnvironment } from '../../models/GameEnvironment';
import { GameNotificationManager } from '../GameNotificationManager';
import { AttackRestrictionManager, AttackRestrictionDuration } from './AttackRestrictionManager';

export class AttackRestrictionService {
    static applyAndNotify(
        gameEnv: GameEnvironment,
        params: {
            playerId: string;
            carduid: string;
            zone?: string;
            unit: any;
            restriction: string;
            duration: AttackRestrictionDuration;
            appliedBy: string;
            sourceCarduid?: string;
        }
    ): void {
        AttackRestrictionManager.applyRestriction(gameEnv, params.unit as any, {
            restriction: params.restriction,
            duration: params.duration,
            appliedBy: params.appliedBy,
            appliedTurn: gameEnv.currentTurn,
            sourceCarduid: params.sourceCarduid
        });

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'ATTACK_RESTRICTION_APPLIED',
            {
                playerId: params.playerId,
                carduid: params.carduid,
                ...(params.zone ? { zone: params.zone } : {}),
                restriction: params.restriction,
                duration: params.duration,
                sourceCarduid: params.sourceCarduid,
                timestamp: Date.now()
            },
            'normal'
        );
    }
}

