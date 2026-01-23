// src/services/restrictions/RestrictionNotificationEmitter.ts
// Centralizes notifications for restriction-driven blocks so frontend can react consistently.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { GameNotificationManager } from '../GameNotificationManager';

export class RestrictionNotificationEmitter {
    static emitSetActiveBlocked(
        gameEnv: GameEnvironment,
        payload: {
            playerId: string;
            carduid?: string;
            carduids?: string[];
            zone?: string;
            reason: string;
            source?: string;
        }
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'CARD_SET_ACTIVE_BLOCKED',
            {
                ...payload,
                timestamp: Date.now()
            },
            'normal'
        );
    }

    static emitPairingBlocked(
        gameEnv: GameEnvironment,
        payload: {
            playerId: string;
            pilotCarduid: string;
            targetUnitCarduid: string;
            reason: string;
        }
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'PAIRING_BLOCKED',
            {
                ...payload,
                timestamp: Date.now()
            },
            'high'
        );
    }
}

