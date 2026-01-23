// src/services/battle/AttackResumeScheduler.ts
// Centralizes scheduling "resume attack" actions after a choice event resolves.

import { GameEnvironment } from '../../models/GameEnvironment';
import { PlayerActionEvent } from '../EventQueue/interfaces/GameEvent';
import { EventFactory } from '../EventQueue/EventFactory';

export class AttackResumeScheduler {
    static enqueueResumeAttackAfterChoice(
        gameEnv: GameEnvironment,
        originalAttackEvent: PlayerActionEvent,
        choiceEventId: string
    ): PlayerActionEvent {
        const resumeEvent = EventFactory.createPlayerActionEvent(
            originalAttackEvent.playerId,
            originalAttackEvent.data.actionType,
            {
                ...originalAttackEvent.data,
                skipAttackDeclaration: true,
                skipAttackPhaseEffects: true,
                resumeAfterChoiceEventId: choiceEventId
            }
        );

        gameEnv.enqueueForProcessing(resumeEvent);
        return resumeEvent;
    }
}

