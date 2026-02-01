// src/services/effects/BurstChoiceService.ts
// Centralized burst choice flow helpers

import { GameEnvironment } from '../../models/GameEnvironment';
import { BurstEffectChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { EventFactory } from '../EventQueue/EventFactory';
import { ChoiceNotificationEmitter } from '../notifications/ChoiceNotificationEmitter';
import { ChoiceTurnSnapshot } from './ChoiceTurnSnapshot';

export class BurstChoiceService {
    static enqueueBurstChoice(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        formattedTarget: any
    ): BurstEffectChoiceEvent {
        const choiceEvent = EventFactory.createBurstEffectChoiceEvent(
            defendingPlayerId,
            [formattedTarget]
        );

        ChoiceTurnSnapshot.attach(gameEnv, choiceEvent.data);

        gameEnv.enqueueForProcessing(choiceEvent);
        ChoiceNotificationEmitter.emitBurstChoiceCreated(gameEnv, choiceEvent);
        console.log(`📤 Enqueued burst choice event: ${choiceEvent.id}`);
        return choiceEvent;
    }
}
