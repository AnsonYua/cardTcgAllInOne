// src/services/GameEndManager.ts
// Centralizes game-end state updates and notifications

import { GameEnvironment } from '../models/GameEnvironment';
import { GameNotificationManager } from './GameNotificationManager';

export class GameEndManager {
    static endGame(gameEnv: GameEnvironment, winnerId: string, reason: string): void {
        if (gameEnv.gameEnded) {
            return;
        }

        const timestamp = Date.now();
        gameEnv.gameEnded = true;
        gameEnv.winnerId = winnerId;
        gameEnv.endReason = reason;
        gameEnv.endedAt = timestamp;

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'GAME_ENDED',
            {
                winnerId,
                reason,
                timestamp
            },
            'high'
        );

        if (typeof gameEnv.gameEndCallback === 'function') {
            gameEnv.gameEndCallback({ winnerId, reason, timestamp });
        }
    }
}
