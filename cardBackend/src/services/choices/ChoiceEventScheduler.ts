// src/services/choices/ChoiceEventScheduler.ts
// Centralizes "enqueue + notify" for choice events so the frontend can drive from notificationQueue.

import { GameEnvironment } from '../../models/GameEnvironment';
import { TargetChoiceEvent, TargetReference, EffectDefinition, TokenChoiceEvent, TokenChoiceOption, OptionChoiceEvent, OptionChoiceOption, PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
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

    static enqueueOptionChoice(
        gameEnv: GameEnvironment,
        params: {
            playerId: string;
            sourceCarduid: string;
            effect: EffectDefinition;
            availableOptions: OptionChoiceOption[];
            context?: Record<string, unknown>;
            cardPlayNotificationId?: string;
        }
    ): OptionChoiceEvent {
        const choiceEvent = EventFactory.createOptionChoiceEvent({
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effect: params.effect,
            availableOptions: params.availableOptions,
            context: params.context
        });

        if (params.cardPlayNotificationId) {
            (choiceEvent.data as any).cardPlayNotificationId = params.cardPlayNotificationId;
        }

        gameEnv.enqueueForProcessing(choiceEvent);
        ChoiceNotificationEmitter.emitOptionChoiceCreated(gameEnv, choiceEvent);
        return choiceEvent;
    }

    static enqueuePromptChoice(
        gameEnv: GameEnvironment,
        params: {
            playerId: string;
            choiceId: string;
            headerText: string;
            promptText: string;
            availableOptions: OptionChoiceOption[];
            defaultOptionIndex?: number;
            sourceCarduid?: string;
            context?: Record<string, unknown>;
            cardPlayNotificationId?: string;
        }
    ): PromptChoiceEvent {
        const choiceEvent = EventFactory.createPromptChoiceEvent({
            playerId: params.playerId,
            choiceId: params.choiceId,
            headerText: params.headerText,
            promptText: params.promptText,
            availableOptions: params.availableOptions,
            defaultOptionIndex: params.defaultOptionIndex,
            sourceCarduid: params.sourceCarduid,
            context: params.context
        });

        if (params.cardPlayNotificationId) {
            (choiceEvent.data as any).cardPlayNotificationId = params.cardPlayNotificationId;
        }

        gameEnv.enqueueForProcessing(choiceEvent);
        ChoiceNotificationEmitter.emitPromptChoiceCreated(gameEnv, choiceEvent);
        return choiceEvent;
    }
}
