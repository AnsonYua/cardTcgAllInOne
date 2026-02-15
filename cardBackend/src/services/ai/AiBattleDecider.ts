import type { AiDecision } from './AiTypes';
import { CHOICE_EVENT_TYPES } from './AiTypes';
import type { AiGameEnvView } from './AiViewTypes';

export function decideActionStepConfirmation(gameEnvView: AiGameEnvView, aiPlayerId: string): AiDecision | null {
    const battle = gameEnvView?.currentBattle;
    if (!battle || battle.status !== 'ACTION_STEP') {
        return null;
    }

    const isParticipant = battle.attackingPlayerId === aiPlayerId || battle.defendingPlayerId === aiPlayerId;
    if (!isParticipant) {
        return null;
    }

    const confirmations = battle.confirmations || {};
    const attackerId = battle.attackingPlayerId;
    const defenderId = battle.defendingPlayerId;
    const bothConfirmed = Boolean(attackerId && defenderId && confirmations[attackerId] === true && confirmations[defenderId] === true);
    if (bothConfirmed) {
        return {
            kind: 'playerAction',
            reason: 'resolve_battle',
            payload: {
                actionType: 'resolveBattle'
            }
        };
    }
    if (confirmations[aiPlayerId] === true) {
        return {
            kind: 'wait',
            reason: 'awaiting_opponent_confirm'
        };
    }

    const queue = Array.isArray(gameEnvView?.processingQueue) ? gameEnvView.processingQueue : [];
    const hasPendingChoice = queue.some((event) =>
        event?.status === 'DECLARED'
        && typeof event?.type === 'string'
        && CHOICE_EVENT_TYPES.has(event.type)
    );
    if (hasPendingChoice) {
        return {
            kind: 'wait',
            reason: 'pending_choice'
        };
    }

    return {
        kind: 'playerAction',
        reason: 'confirm_action_step',
        payload: {
            actionType: 'confirmBattle'
        }
    };
}
