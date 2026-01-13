// src/services/validation/EventValidator.ts
// Validation rules for event execution

import { GameEvent, JoinGameEvent, ConfirmRedrawEvent, ChooseFirstPlayerEvent } from '../EventQueue/interfaces/GameEvent';
import { ValidationResult } from '../../models/EventInterfaces';
import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase, EventType } from '../../models/GameEnums';

export const validateEventExecution = (event: GameEvent, gameEnv: GameEnvironment): ValidationResult => {
    console.log(`🔍 Validating event: ${event.type}`);

    switch (event.type) {
        case EventType.JOIN_GAME:
            return validateJoinGameEvent(event as JoinGameEvent, gameEnv);

        case EventType.CHOOSE_FIRST_PLAYER:
            return validateChooseFirstPlayerEvent(event as ChooseFirstPlayerEvent, gameEnv);

        case EventType.CONFIRM_REDRAW:
            return validateStartReadyEvent(event as ConfirmRedrawEvent, gameEnv);

        default:
            return { isValid: true };
    }
};

const validateJoinGameEvent = (event: JoinGameEvent, gameEnv: GameEnvironment): ValidationResult => {
    const { playerId } = event.data;

    if (gameEnv.phase !== GamePhase.WAITING_FOR_PLAYERS) {
        return {
            isValid: false,
            reason: 'Room is not available for joining'
        };
    }

    if (gameEnv.playerId_2 && gameEnv.playerId_2 !== playerId) {
        return {
            isValid: false,
            reason: 'Game is full'
        };
    }

    return { isValid: true };
};

const validateStartReadyEvent = (event: ConfirmRedrawEvent, gameEnv: GameEnvironment): ValidationResult => {
    const { playerId } = event;

    if (playerId !== gameEnv.playerId_1 && playerId !== gameEnv.playerId_2) {
        return {
            isValid: false,
            reason: 'Player not found in game'
        };
    }

    if (gameEnv.phase !== GamePhase.REDRAW_PHASE) {
        return {
            isValid: false,
            reason: 'Redraw is not available in the current phase'
        };
    }

    return { isValid: true };
};

const validateChooseFirstPlayerEvent = (event: ChooseFirstPlayerEvent, gameEnv: GameEnvironment): ValidationResult => {
    const { playerId, chosenFirstPlayerId } = event.data;

    if (gameEnv.phase !== GamePhase.DECIDE_FIRST_PLAYER_PHASE) {
        return {
            isValid: false,
            reason: 'First player decision is not available in the current phase'
        };
    }

    if (playerId !== gameEnv.firstPlayerChooser) {
        return {
            isValid: false,
            reason: 'Player is not allowed to choose first player'
        };
    }

    if (chosenFirstPlayerId !== gameEnv.playerId_1 && chosenFirstPlayerId !== gameEnv.playerId_2) {
        return {
            isValid: false,
            reason: 'Chosen player is not part of this game'
        };
    }

    return { isValid: true };
};
