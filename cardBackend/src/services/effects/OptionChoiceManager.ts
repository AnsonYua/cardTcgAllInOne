// src/services/effects/OptionChoiceManager.ts
// Executes generic OPTION_CHOICE events.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EventStatus, OptionChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import type { ExecutionResult } from '../ExecutionResult';
import { TutorTopDeckManager } from './TutorTopDeckManager';

export class OptionChoiceManager {
    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        if (event.status !== EventStatus.RESOLVING) {
            return { success: true };
        }

        const action = event.data.effect?.action;
        switch (action) {
            case 'tutor_top_deck':
                return TutorTopDeckManager.executeOptionChoice(event, gameEnv);
            default:
                return { success: false, error: `OPTION_CHOICE unsupported effect action: ${action || 'unknown'}` };
        }
    }
}

