// src/services/effects/PromptChoiceManager.ts
// Executes generic PROMPT_CHOICE events.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EventStatus, type PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import type { ExecutionResult } from '../ExecutionResult';
import { TutorTopDeckManager } from './TutorTopDeckManager';
import { DeployEffectOrderManager } from './DeployEffectOrderManager';
import { TUTOR_TOP_DECK_REVEAL_CHOICE_ID } from './tutorTopDeck/TutorTopDeckFlowUtils';

export class PromptChoiceManager {
    static executePromptChoice(event: PromptChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        if (event.status !== EventStatus.RESOLVING) {
            return { success: true };
        }

        if (event.data?.context && (event.data.context as any).kind === 'DEPLOY_EFFECT_ORDER') {
            return DeployEffectOrderManager.executePromptChoice(event, gameEnv);
        }
        if (event.data?.context && (event.data.context as any).kind === 'TUTOR_TOP_DECK_REVEAL_CONFIRM') {
            return TutorTopDeckManager.executeRevealConfirmPromptChoice(event, gameEnv);
        }

        switch (event.data.choiceId) {
            case 'tutor_top_deck_position':
                return TutorTopDeckManager.executePromptChoice(event, gameEnv);
            case TUTOR_TOP_DECK_REVEAL_CHOICE_ID:
                return TutorTopDeckManager.executeRevealConfirmPromptChoice(event, gameEnv);
            default:
                return { success: false, error: `PROMPT_CHOICE unsupported choiceId: ${event.data.choiceId || 'unknown'}` };
        }
    }
}
