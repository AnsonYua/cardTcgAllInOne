// src/services/effects/BurstChoiceService.ts
// Centralized burst choice flow helpers

import { GameEnvironment } from '../../models/GameEnvironment';
import { BurstEffectChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { EventFactory } from '../EventQueue/EventFactory';
import { ChoiceNotificationEmitter } from '../notifications/ChoiceNotificationEmitter';

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

        const previousPlayerId = gameEnv.currentPlayer;
        choiceEvent.data.previousPlayerId = previousPlayerId;
        if (previousPlayerId !== defendingPlayerId) {
            gameEnv.currentPlayer = defendingPlayerId;
            console.log(`🔄 Burst choice turn override: ${previousPlayerId} → ${defendingPlayerId}`);
        }

        gameEnv.enqueueForProcessing(choiceEvent);
        ChoiceNotificationEmitter.emitBurstChoiceCreated(gameEnv, choiceEvent);
        console.log(`📤 Enqueued burst choice event: ${choiceEvent.id}`);
        return choiceEvent;
    }

    static restoreBurstCurrentPlayer(
        gameEnv: GameEnvironment,
        event: BurstEffectChoiceEvent
    ): void {
        const previousPlayerId = event.data?.previousPlayerId;
        if (!previousPlayerId) {
            return;
        }

        if (gameEnv.currentPlayer !== previousPlayerId) {
            console.log(`🔄 Burst choice turn restore: ${gameEnv.currentPlayer} → ${previousPlayerId}`);
            gameEnv.currentPlayer = previousPlayerId;
        }
    }
}
