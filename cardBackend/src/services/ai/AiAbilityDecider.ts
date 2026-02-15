import type { AiDecision } from './AiTypes';
import type { AiGameEnvView } from './AiViewTypes';
import { findBestCommandAction } from './AiCommandPlanner';
import { findBestFieldAbilityAction } from './AiFieldAbilityPlanner';

export function findNonAttackAction(gameEnvView: AiGameEnvView, aiPlayerId: string): AiDecision | null {
    if (gameEnvView?.phase !== 'MAIN_PHASE') {
        return null;
    }
    if (gameEnvView?.currentBattle) {
        return null;
    }

    const commandAction = findBestCommandAction(gameEnvView, aiPlayerId);
    if (commandAction) {
        return commandAction;
    }

    const fieldAbilityAction = findBestFieldAbilityAction(gameEnvView, aiPlayerId);
    if (fieldAbilityAction) {
        return fieldAbilityAction;
    }

    return null;
}
