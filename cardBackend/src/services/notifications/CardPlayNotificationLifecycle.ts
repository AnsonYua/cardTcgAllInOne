import { GameEnvironment } from '../../models/GameEnvironment';
import type { PlayCardEventData } from '../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../GameNotificationManager';

type CardDataShape = {
    id?: string;
    cardId?: string;
    name?: string;
    cardType?: string;
};

export type CardPlayedNotificationPayload = {
    carduid: string;
    playerId: string;
    playAs?: string;
    reason: 'hand' | 'burst';
    fromBurst: boolean;
    targetUnit?: string;
    slotName?: string;
    isCompleted: boolean;
    timestamp: number;
    cardId?: string;
    cardName?: string;
    cardType?: string;
};

export class CardPlayNotificationLifecycle {
    static buildPayload(
        eventData: PlayCardEventData,
        playerId: string,
        cardData?: CardDataShape | null
    ): CardPlayedNotificationPayload {
        const reason: 'hand' | 'burst' = eventData.fromBurst ? 'burst' : 'hand';
        const playAs = eventData.playAs;
        const immediateComplete = this.shouldCompleteImmediately(playAs, reason);

        const cardId = cardData?.id || cardData?.cardId || undefined;
        const cardType = cardData?.cardType || undefined;
        const cardName = cardData?.name || undefined;

        return {
            carduid: eventData.carduid,
            playerId,
            playAs,
            reason,
            fromBurst: Boolean(eventData.fromBurst),
            targetUnit: eventData.targetUnit,
            slotName: eventData.slotName,
            isCompleted: immediateComplete,
            timestamp: Date.now(),
            ...(cardId ? { cardId } : {}),
            ...(cardName ? { cardName } : {}),
            ...(cardType ? { cardType } : {})
        };
    }

    static createCardPlayedNotification(
        gameEnv: GameEnvironment,
        payload: CardPlayedNotificationPayload
    ): string {
        const notificationManager = new GameNotificationManager(gameEnv);
        return notificationManager.addNotificationEvent('CARD_PLAYED', payload, 'normal');
    }

    static markCompleted(gameEnv: GameEnvironment, notificationId?: string): boolean {
        if (!notificationId) return false;
        const notificationManager = new GameNotificationManager(gameEnv);
        const event = this.findNotificationById(gameEnv, notificationId);
        if (!event) return false;

        const alreadyCompleted = event.type === 'CARD_PLAYED_COMPLETED' || event.payload?.isCompleted === true;
        if (alreadyCompleted) return true;

        return notificationManager.updateNotificationEvent(notificationId, { isCompleted: true });
    }

    private static shouldCompleteImmediately(playAs?: string, reason?: string): boolean {
        return this.normalize(playAs) === 'command' && this.normalize(reason) === 'hand';
    }

    private static normalize(value: unknown): string {
        return String(value ?? '').trim().toLowerCase();
    }

    private static findNotificationById(gameEnv: GameEnvironment, notificationId: string) {
        if (!Array.isArray(gameEnv.notificationQueue)) return undefined;
        return gameEnv.notificationQueue.find((event) => event?.id === notificationId);
    }
}
