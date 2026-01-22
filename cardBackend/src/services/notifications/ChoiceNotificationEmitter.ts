// src/services/notifications/ChoiceNotificationEmitter.ts
// Centralized notification helpers for choice-based UI flows

import { GameEnvironment } from '../../models/GameEnvironment';
import { BlockerChoiceEvent, BurstEffectChoiceEvent, TargetChoiceEvent, TokenChoiceEvent, OptionChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../GameNotificationManager';

export class ChoiceNotificationEmitter {
    static emitBurstChoiceCreated(gameEnv: GameEnvironment, event: BurstEffectChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEventWithId(event.id, 'BURST_EFFECT_CHOICE', {
            playerId: event.playerId,
            event
        }, 'high');
    }

    static emitBurstChoiceResolved(
        gameEnv: GameEnvironment,
        event: BurstEffectChoiceEvent,
        userDecision: 'ACTIVATE' | 'DECLINE'
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const resolvedId = `${event.id}_resolved`;
        notificationManager.addNotificationEventWithId(resolvedId, 'BURST_EFFECT_CHOICE_RESOLVED', {
            playerId: event.playerId,
            eventId: event.id,
            choiceId: event.data?.choiceId,
            userDecision
        }, 'normal');
    }

    static emitBlockerChoiceCreated(gameEnv: GameEnvironment, event: BlockerChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEventWithId(event.id, 'BLOCKER_CHOICE', {
            playerId: event.playerId,
            event
        }, 'high');
    }

    static emitBlockerChoiceResolved(
        gameEnv: GameEnvironment,
        event: BlockerChoiceEvent,
        userDecision: 'BLOCK' | 'DECLINE'
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const resolvedId = `${event.id}_resolved`;
        notificationManager.addNotificationEventWithId(resolvedId, 'BLOCKER_CHOICE_RESOLVED', {
            playerId: event.playerId,
            eventId: event.id,
            choiceId: event.data?.choiceId,
            userDecision
        }, 'normal');
    }

    static emitTargetChoiceCreated(gameEnv: GameEnvironment, event: TargetChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEventWithId(event.id, 'TARGET_CHOICE', {
            playerId: event.playerId,
            event
        }, 'high');
    }

    static emitTargetChoiceResolved(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const resolvedId = `${event.id}_resolved`;
        notificationManager.addNotificationEventWithId(resolvedId, 'TARGET_CHOICE_RESOLVED', {
            playerId: event.playerId,
            eventId: event.id,
            choiceId: event.data?.choiceId
        }, 'normal');
    }

    static emitTokenChoiceCreated(gameEnv: GameEnvironment, event: TokenChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEventWithId(event.id, 'TOKEN_CHOICE', {
            playerId: event.playerId,
            event
        }, 'high');
    }

    static emitTokenChoiceResolved(gameEnv: GameEnvironment, event: TokenChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const resolvedId = `${event.id}_resolved`;
        notificationManager.addNotificationEventWithId(resolvedId, 'TOKEN_CHOICE_RESOLVED', {
            playerId: event.playerId,
            eventId: event.id,
            choiceId: event.data?.choiceId
        }, 'normal');
    }

    static emitOptionChoiceCreated(gameEnv: GameEnvironment, event: OptionChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEventWithId(event.id, 'OPTION_CHOICE', {
            playerId: event.playerId,
            event
        }, 'high');
    }

    static emitOptionChoiceResolved(gameEnv: GameEnvironment, event: OptionChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const resolvedId = `${event.id}_resolved`;
        notificationManager.addNotificationEventWithId(resolvedId, 'OPTION_CHOICE_RESOLVED', {
            playerId: event.playerId,
            eventId: event.id,
            choiceId: event.data?.choiceId
        }, 'normal');
    }
}
