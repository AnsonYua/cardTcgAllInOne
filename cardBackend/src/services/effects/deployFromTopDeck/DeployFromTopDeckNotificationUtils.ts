import type { GameEnvironment } from '../../../models/GameEnvironment';
import { GameNotificationManager } from '../../GameNotificationManager';

export function emitDeployTopDeckViewed(params: {
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

export function emitDeployCardsMovedToBottom(params: {
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

export function emitDeployFromTopDeckResolved(params: {
    gameEnv: GameEnvironment;
    playerId: string;
    sourceCarduid: string;
    effectId?: string;
    result: string;
    movedCarduids?: string[];
    deployedCarduid?: string;
    error?: string;
}) {
    const notificationManager = new GameNotificationManager(params.gameEnv);
    notificationManager.addNotificationEvent(
        'DEPLOY_FROM_TOP_DECK_RESOLVED',
        {
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effectId: params.effectId,
            result: params.result,
            movedCarduids: params.movedCarduids,
            deployedCarduid: params.deployedCarduid,
            error: params.error,
            timestamp: Date.now(),
        },
        params.error ? 'high' : 'normal',
    );
}
