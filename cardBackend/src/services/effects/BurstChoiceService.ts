// src/services/effects/BurstChoiceService.ts
// Centralized burst choice flow helpers

import { GameEnvironment } from '../../models/GameEnvironment';
import { BurstEffectChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { EventFactory } from '../EventQueue/EventFactory';
import { ChoiceNotificationEmitter } from '../notifications/ChoiceNotificationEmitter';
import { ChoiceTurnSnapshot } from './ChoiceTurnSnapshot';

export class BurstChoiceService {
    private static buildBurstSourceSummary(formattedTarget: any): Record<string, unknown> | undefined {
        if (!formattedTarget || typeof formattedTarget !== 'object') {
            return undefined;
        }

        const carduid = typeof formattedTarget.carduid === 'string' ? formattedTarget.carduid : undefined;
        const cardId = typeof formattedTarget.cardId === 'string' ? formattedTarget.cardId : undefined;

        const cardData = formattedTarget.cardData;
        const name = typeof cardData?.name === 'string'
            ? cardData.name
            : (typeof formattedTarget.displayName === 'string' ? formattedTarget.displayName : undefined);

        const cardType = typeof cardData?.cardType === 'string' ? cardData.cardType : undefined;
        const sourceZone = typeof formattedTarget.sourceZone === 'string' ? formattedTarget.sourceZone : undefined;
        const ownerPlayerId = typeof formattedTarget.ownerPlayerId === 'string' ? formattedTarget.ownerPlayerId : undefined;
        const attackContext = (formattedTarget as any).attackContext && typeof (formattedTarget as any).attackContext === 'object'
            ? (formattedTarget as any).attackContext
            : undefined;

        return {
            carduid,
            cardId,
            name,
            cardType,
            sourceZone,
            ownerPlayerId,
            attackContext
        };
    }

    static enqueueBurstChoices(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        formattedTargets: any[],
        options: { sourceEventId?: string } = {}
    ): BurstEffectChoiceEvent[] {
        const targets = Array.isArray(formattedTargets) ? formattedTargets : [];
        const createdEvents: BurstEffectChoiceEvent[] = [];

        for (const target of targets) {
            const choiceEvent = EventFactory.createBurstEffectChoiceEvent(
                defendingPlayerId,
                [target]
            );

            ChoiceTurnSnapshot.attach(gameEnv, choiceEvent.data);
            (choiceEvent.data as any).burstSource = BurstChoiceService.buildBurstSourceSummary(target);
            gameEnv.enqueueForProcessing(choiceEvent);
            createdEvents.push(choiceEvent);
            console.log(`📤 Enqueued burst choice event: ${choiceEvent.id}`);
        }

        if (createdEvents.length === 1) {
            ChoiceNotificationEmitter.emitBurstChoiceCreated(gameEnv, createdEvents[0]);
        } else if (createdEvents.length > 1) {
            ChoiceNotificationEmitter.emitBurstChoiceGroupCreated(gameEnv, {
                playerId: defendingPlayerId,
                sourceEventId: options.sourceEventId || createdEvents[0].id,
                events: createdEvents
            });
        }

        return createdEvents;
    }

    static enqueueBurstChoice(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        formattedTarget: any
    ): BurstEffectChoiceEvent {
        const events = BurstChoiceService.enqueueBurstChoices(
            gameEnv,
            defendingPlayerId,
            [formattedTarget]
        );
        return events[0];
    }
}
