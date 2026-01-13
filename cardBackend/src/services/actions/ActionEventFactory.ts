// src/services/actions/ActionEventFactory.ts
// Centralized mapping from player actions to game events

import { PlayerActionType, EventType } from '../../models/GameEnums';
import { PlayerAction } from '../../models/EventInterfaces';
import { EventFactory, EventStatus, EventPriority } from '../EventQueue';
import { GameEvent } from '../EventQueue/interfaces/GameEvent';

export const createEventFromAction = (action: PlayerAction): GameEvent | null => {
    console.log('action ', JSON.stringify(action));

    switch (action.type) {
        case PlayerActionType.CREATE_GAME:
            return {
                id: action.type.toLowerCase() + `_${Date.now()}_${Math.random()}`,
                type: EventType.CREATE_GAME,
                status: EventStatus.DECLARED,
                priority: EventPriority.HIGH,
                timestamp: Date.now(),
                playerId: action.playerId,
                data: {
                    playerId: action.playerId,
                    gameId: action.gameId
                }
            };

        case PlayerActionType.JOIN_GAME:
            return {
                id: action.type.toLowerCase() + `_${Date.now()}_${Math.random()}`,
                type: EventType.JOIN_GAME,
                status: EventStatus.DECLARED,
                priority: EventPriority.HIGH,
                timestamp: Date.now(),
                playerId: action.playerId,
                data: {
                    playerId: action.playerId,
                    gameId: action.gameId
                }
            };

        case PlayerActionType.CHOOSE_FIRST_PLAYER:
            return {
                id: action.type.toLowerCase() + `_${Date.now()}_${Math.random()}`,
                type: EventType.CHOOSE_FIRST_PLAYER,
                status: EventStatus.DECLARED,
                priority: EventPriority.NORMAL,
                timestamp: Date.now(),
                playerId: action.playerId,
                data: {
                    playerId: action.playerId,
                    gameId: action.gameId,
                    chosenFirstPlayerId: action.chosenFirstPlayerId
                }
            };

        case PlayerActionType.CONFIRM_REDRAW:
            return {
                id: `start_ready_${Date.now()}_${Math.random()}`,
                type: EventType.CONFIRM_REDRAW,
                status: EventStatus.DECLARED,
                priority: EventPriority.NORMAL,
                timestamp: Date.now(),
                playerId: action.playerId,
                data: {
                    playerId: action.playerId,
                    gameId: action.gameId,
                    isRedraw: action.isRedraw || false
                }
            };

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
            return {
                id: `player_action_${Date.now()}_${Math.random()}`,
                type: EventType.PLAYER_ACTION,
                status: EventStatus.DECLARED,
                priority: EventPriority.NORMAL,
                timestamp: Date.now(),
                playerId: action.playerId,
                data: {
                    ...action
                }
            };

        default:
            console.warn(`⚠️ Unknown action type: ${action.type}`);
            return null;
    }
};
