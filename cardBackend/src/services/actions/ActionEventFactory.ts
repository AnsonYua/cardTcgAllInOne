// src/services/actions/ActionEventFactory.ts
// Centralized mapping from player actions to game events

import { PlayerActionType, EventType } from '../../models/GameEnums';
import { PlayerAction } from '../../models/EventInterfaces';
import { EventFactory, EventPriority, EventStatus } from '../EventQueue';
import { GameEvent } from '../EventQueue/interfaces/GameEvent';

export const createEventFromAction = (action: PlayerAction): GameEvent | null => {
    console.log('action ', JSON.stringify(action));

    switch (action.type) {
        case PlayerActionType.CREATE_GAME:
            if (!action.gameId) {
                console.warn('⚠️ CREATE_GAME action missing gameId', action);
                return null;
            }
            return EventFactory.createStartGameEvent(action.playerId, action.gameId);

        case PlayerActionType.JOIN_GAME:
            if (!action.gameId) {
                console.warn('⚠️ JOIN_GAME action missing gameId', action);
                return null;
            }
            return EventFactory.createJoinGameEvent(action.playerId, action.gameId);

        case PlayerActionType.CHOOSE_FIRST_PLAYER:
            if (!action.gameId || !action.chosenFirstPlayerId) {
                console.warn('⚠️ CHOOSE_FIRST_PLAYER action missing required identifiers', action);
                return null;
            }
            return EventFactory.createBaseEvent(
                EventType.CHOOSE_FIRST_PLAYER,
                action.playerId,
                {
                    playerId: action.playerId,
                    gameId: action.gameId,
                    chosenFirstPlayerId: action.chosenFirstPlayerId
                },
                { status: EventStatus.DECLARED, priority: EventPriority.NORMAL }
            );

        case PlayerActionType.CONFIRM_REDRAW:
            if (!action.gameId) {
                console.warn('⚠️ CONFIRM_REDRAW action missing gameId', action);
                return null;
            }
            return EventFactory.createBaseEvent(
                EventType.CONFIRM_REDRAW,
                action.playerId,
                {
                    playerId: action.playerId,
                    gameId: action.gameId,
                    isRedraw: action.isRedraw || false
                },
                { status: EventStatus.DECLARED, priority: EventPriority.NORMAL }
            );

        case PlayerActionType.END_TURN:
            return EventFactory.createEndTurnEvent(
                action.playerId,
                action.currentTurn || 0
            );

        case PlayerActionType.PLAY_CARD:
            if (!action.gameId || !action.carduid) {
                console.warn('⚠️ PLAY_CARD action missing required identifiers', action);
                return null;
            }

            return EventFactory.createPlayCardEvent(
                action.playerId,
                action.gameId,
                action.carduid,
                action.playAs || 'unit',
                action.targetUnit,
                {
                    fromBurst: action.fromBurst,
                    cardId: action.cardId,
                    slotName: action.slotName
                }
            );

        case PlayerActionType.PLAYER_ACTION:
            if (typeof action.actionType !== 'string' || action.actionType.length === 0) {
                console.warn('⚠️ PLAYER_ACTION missing actionType', action);
                return null;
            }
            return EventFactory.createPlayerActionEvent(action.playerId, action.actionType, { ...action });

        default:
            console.warn(`⚠️ Unknown action type: ${action.type}`);
            return null;
    }
};
