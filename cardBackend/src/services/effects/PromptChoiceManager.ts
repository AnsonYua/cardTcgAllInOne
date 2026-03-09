// src/services/effects/PromptChoiceManager.ts
// Executes generic PROMPT_CHOICE events.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EventStatus, type PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import type { ExecutionResult } from '../ExecutionResult';
import { TopDeckSelectionManager } from './TopDeckSelectionManager';
import { DeployEffectOrderManager } from './DeployEffectOrderManager';
import { ScryTopDeckManager } from './ScryTopDeckManager';
import { TOP_DECK_SELECTION_REVIEW_CHOICE_ID } from './topDeckSelection/TopDeckSelectionFlowUtils';

export class PromptChoiceManager {
    static executePromptChoice(event: PromptChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        if (event.status !== EventStatus.RESOLVING) {
            return { success: true };
        }

        if (event.data?.context && (event.data.context as any).kind === 'DEPLOY_EFFECT_ORDER') {
            return DeployEffectOrderManager.executePromptChoice(event, gameEnv);
        }
        if (event.data?.context && (event.data.context as any).kind === 'TOP_DECK_SELECTION_REVIEW_CONFIRM') {
            return TopDeckSelectionManager.executeReviewConfirmPromptChoice(event, gameEnv);
        }

        switch (event.data.choiceId) {
            case TOP_DECK_SELECTION_REVIEW_CHOICE_ID:
                return TopDeckSelectionManager.executeReviewConfirmPromptChoice(event, gameEnv);
            default:
                return { success: false, error: `PROMPT_CHOICE unsupported choiceId: ${event.data.choiceId || 'unknown'}` };
        }
    }
}
