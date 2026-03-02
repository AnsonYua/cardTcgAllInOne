// src/services/battle/AttackResumeScheduler.ts
// Centralizes scheduling "resume attack" actions after a choice event resolves.

import { GameEnvironment } from '../../models/GameEnvironment';
import { PlayerActionEvent } from '../EventQueue/interfaces/GameEvent';
import { EventFactory } from '../EventQueue/EventFactory';

export class AttackResumeScheduler {
    static enqueueResumeAttack(
        gameEnv: GameEnvironment,
        originalAttackEvent: PlayerActionEvent,
        options: {
            resumeAfterChoiceEventId?: string;
        } = {}
    ): PlayerActionEvent {
        const resumeEvent = EventFactory.createPlayerActionEvent(
            originalAttackEvent.playerId,
            originalAttackEvent.data.actionType,
            {
                ...originalAttackEvent.data,
                skipAttackDeclaration: true,
                skipAttackPhaseEffects: true,
                ...(options.resumeAfterChoiceEventId
                    ? { resumeAfterChoiceEventId: options.resumeAfterChoiceEventId }
                    : {})
            }
        );

        gameEnv.enqueueForProcessing(resumeEvent);
        return resumeEvent;
    }

    static enqueueResumeAttackAfterChoice(
        gameEnv: GameEnvironment,
        originalAttackEvent: PlayerActionEvent,
        choiceEventId: string
    ): PlayerActionEvent {
        return this.enqueueResumeAttack(gameEnv, originalAttackEvent, {
            resumeAfterChoiceEventId: choiceEventId
        });
    }
}
