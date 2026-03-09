import type { GameEnvironment } from '../../../models/GameEnvironment';
import { GameNotificationManager } from '../../GameNotificationManager';

export function emitTopDeckSelectionViewed(params: {
    gameEnv: GameEnvironment;
    playerId: string;
    sourceCarduid: string;
    effectId?: string;
    cards: any[];
}) {
    const notificationManager = new GameNotificationManager(params.gameEnv);
    notificationManager.addNotificationEvent(
        'TOP_DECK_VIEWED',
        {
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effectId: params.effectId,
            count: params.cards.length,
            cards: params.cards,
            revealToOpponent: false,
            timestamp: Date.now(),
        },
        'normal',
    );
}

export function emitTopDeckSelectionCardsMovedToBottom(params: {
    gameEnv: GameEnvironment;
    playerId: string;
    sourceCarduid: string;
    effectId?: string;
    carduids: string[];
    reason: string;
}) {
    const notificationManager = new GameNotificationManager(params.gameEnv);
    notificationManager.addNotificationEvent(
        'CARDS_MOVED_TO_DECK_BOTTOM',
        {
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effectId: params.effectId,
            carduids: params.carduids,
            reason: params.reason,
            timestamp: Date.now(),
        },
        'normal',
    );
}

export function emitTopDeckSelectionResolved(params: {
    gameEnv: GameEnvironment;
    playerId: string;
    sourceCarduid: string;
    effectId?: string;
    toZone: 'hand' | 'play';
    result: string;
    movedCarduids?: string[];
    selectedCarduid?: string;
    leftCarduids?: string[];
    error?: string;
}) {
    const notificationManager = new GameNotificationManager(params.gameEnv);
    const eventType = params.toZone === 'play' ? 'DEPLOY_FROM_TOP_DECK_RESOLVED' : 'TUTOR_TOP_DECK_RESOLVED';
    const payload = {
        playerId: params.playerId,
        sourceCarduid: params.sourceCarduid,
        effectId: params.effectId,
        result: params.result,
        movedCarduids: params.movedCarduids,
        timestamp: Date.now(),
        ...(params.toZone === 'play'
            ? { deployedCarduid: params.selectedCarduid, error: params.error }
            : { addedCarduid: params.selectedCarduid, leftCarduids: params.leftCarduids }),
    };
    notificationManager.addNotificationEvent(eventType, payload, params.error ? 'high' : 'normal');
}
