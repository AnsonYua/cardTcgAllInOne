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
        const loserId = gameEnv.getOpponentId(winnerId);
        gameEnv.gameEnded = true;
        gameEnv.winnerId = winnerId;
        gameEnv.endReason = reason;
        gameEnv.endedAt = timestamp;

        const notificationManager = new GameNotificationManager(gameEnv);
        const notificationId = `game_ended_${timestamp}`;
        notificationManager.addNotificationEventWithId(
            notificationId,
            'GAME_ENDED',
            {
                winnerId,
                loserId,
                reason,
                endedAt: timestamp,
                timestamp
            },
            'critical'
        );
        notificationManager.makePersistent(notificationId);

        if (typeof gameEnv.gameEndCallback === 'function') {
            gameEnv.gameEndCallback({ winnerId, reason, timestamp });
        }
    }
}
