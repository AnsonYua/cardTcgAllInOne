// src/services/choices/ChoiceEventScheduler.ts
// Centralizes "enqueue + notify" for choice events so the frontend can drive from notificationQueue.

import { GameEnvironment } from '../../models/GameEnvironment';
import { TargetChoiceEvent, TargetReference, EffectDefinition, TokenChoiceEvent, TokenChoiceOption } from '../EventQueue/interfaces/GameEvent';
import { EventFactory } from '../EventQueue/EventFactory';
import { ChoiceNotificationEmitter } from '../notifications/ChoiceNotificationEmitter';

export class ChoiceEventScheduler {
    static enqueueTargetChoice(
        gameEnv: GameEnvironment,
        params: {
            playerId: string;
            sourceCarduid: string;
            effect: EffectDefinition;
            availableTargets: TargetReference[];
            cardPlayNotificationId?: string;
        }
    ): TargetChoiceEvent {
        const choiceEvent = EventFactory.createTargetChoiceEvent({
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effect: params.effect,
            availableTargets: params.availableTargets
        });

        if (params.cardPlayNotificationId) {
            (choiceEvent.data as any).cardPlayNotificationId = params.cardPlayNotificationId;
        }

        gameEnv.enqueueForProcessing(choiceEvent);
        ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, choiceEvent);
        return choiceEvent;
    }

    static enqueueTokenChoice(
        gameEnv: GameEnvironment,
        params: {
            playerId: string;
            sourceCarduid: string;
            effect: EffectDefinition;
            availableChoices: TokenChoiceOption[];
            cardPlayNotificationId?: string;
        }
    ): TokenChoiceEvent {
        const choiceEvent = EventFactory.createTokenChoiceEvent({
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effect: params.effect,
            availableChoices: params.availableChoices
        });

        if (params.cardPlayNotificationId) {
            (choiceEvent.data as any).cardPlayNotificationId = params.cardPlayNotificationId;
        }

        gameEnv.enqueueForProcessing(choiceEvent);
        ChoiceNotificationEmitter.emitTokenChoiceCreated(gameEnv, choiceEvent);
        return choiceEvent;
    }
}

