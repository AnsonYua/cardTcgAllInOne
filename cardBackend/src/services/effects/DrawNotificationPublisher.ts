import type { GameEnvironment } from '../../models/GameEnvironment';
import { GameNotificationManager } from '../GameNotificationManager';

type PublishDrawNotificationsParams = {
    playerId: string;
    drawnCarduids: string[];
    drawContext?: string;
    sourceZone?: string;
    reason?: string;
};

type DrawEventPayload = {
    playerId: string;
    carduid: string;
    sourceZone: string;
    reason: string;
    timestamp: number;
    drawContext?: string;
    drawBatchId?: string;
};

type DrawBatchPayload = {
    playerId: string;
    carduids: string[];
    count: number;
    sourceZone: string;
    reason: string;
    timestamp: number;
    drawContext?: string;
    drawBatchId: string;
};

function createDrawBatchId(playerId: string): string {
    return `draw_batch_${Date.now()}_${playerId}_${Math.random().toString(36).slice(2, 9)}`;
}

export class DrawNotificationPublisher {
    static publishDrawNotifications(gameEnv: GameEnvironment, params: PublishDrawNotificationsParams): string | undefined {
        const drawnCarduids = Array.isArray(params.drawnCarduids)
            ? params.drawnCarduids.filter((uid): uid is string => typeof uid === 'string' && uid.length > 0)
            : [];
        if (drawnCarduids.length === 0) {
            return undefined;
        }

        const notificationManager = new GameNotificationManager(gameEnv);
        const sourceZone = params.sourceZone ?? 'deck';
        const reason = params.reason ?? 'draw';
        const drawBatchId = drawnCarduids.length > 1 ? createDrawBatchId(params.playerId) : undefined;

        for (const carduid of drawnCarduids) {
            const perCardPayload: DrawEventPayload = {
                playerId: params.playerId,
                carduid,
                sourceZone,
                reason,
                timestamp: Date.now(),
                drawContext: params.drawContext,
                drawBatchId
            };
            notificationManager.addNotificationEvent('CARD_DRAWN', perCardPayload, 'normal');
        }

        if (drawBatchId) {
            const groupedPayload: DrawBatchPayload = {
                playerId: params.playerId,
                carduids: drawnCarduids,
                count: drawnCarduids.length,
                sourceZone,
                reason,
                timestamp: Date.now(),
                drawContext: params.drawContext,
                drawBatchId
            };
            notificationManager.addNotificationEvent('CARDS_DRAWN', groupedPayload, 'normal');
        }

        return drawBatchId;
    }
}
