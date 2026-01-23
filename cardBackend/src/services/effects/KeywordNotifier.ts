import type { GameEnvironment } from '../../models/GameEnvironment';
import { GameNotificationManager } from '../GameNotificationManager';

export class KeywordNotifier {
    static notifyGranted(
        gameEnv: GameEnvironment,
        payload: {
            playerId: string;
            sourceCarduid?: string;
            targetCarduid: string;
            keyword: string;
            value?: number;
            duration: string;
        }
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'KEYWORD_GRANTED',
            {
                playerId: payload.playerId,
                sourceCarduid: payload.sourceCarduid,
                targetCarduid: payload.targetCarduid,
                keyword: payload.keyword,
                ...(typeof payload.value === 'number' ? { value: payload.value } : {}),
                duration: payload.duration,
                timestamp: Date.now()
            },
            'normal'
        );
    }
}

