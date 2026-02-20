import type { GameEnvironment } from '../../../models/GameEnvironment';
import { GameNotificationManager } from '../../GameNotificationManager';

export function emitTutorTopDeckViewed(params: {
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

export function emitTutorCardsMovedToBottom(params: {
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

export function emitTutorTopDeckResolved(params: {
    gameEnv: GameEnvironment;
    playerId: string;
    sourceCarduid: string;
    effectId?: string;
    result: string;
    movedCarduids?: string[];
    addedCarduid?: string;
    leftCarduids?: string[];
}) {
    const notificationManager = new GameNotificationManager(params.gameEnv);
    notificationManager.addNotificationEvent(
        'TUTOR_TOP_DECK_RESOLVED',
        {
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effectId: params.effectId,
            result: params.result,
            movedCarduids: params.movedCarduids,
            addedCarduid: params.addedCarduid,
            leftCarduids: params.leftCarduids,
            timestamp: Date.now(),
        },
        'normal',
    );
}
