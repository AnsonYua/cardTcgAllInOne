import type { AiDecision } from './AiTypes';
import { validateScopeMatrix } from './AiScopeValidator';
import { decideSetupPhase } from './AiSetupDecider';
import { decideChoiceIfPending } from './AiChoiceResolver';
import { decideActionStepConfirmation } from './AiBattleDecider';
import { getOpponentId } from './AiPlayerUtils';
import { findNonAttackAction } from './AiAbilityDecider';
import { findWinningShieldAttack, findBestUnitAttack, findSafeShieldAttack } from './AiAttackDecider';
import { findBestPlayCard } from './AiPlayDecider';

export class GameAiService {
    static decide(gameEnvView: any, aiPlayerId: string): AiDecision {
        const scopeIssue = validateScopeMatrix(gameEnvView, aiPlayerId);
        if (scopeIssue) {
            return {
                kind: 'wait',
                reason: `scope_violation:${scopeIssue}`
            };
        }

        const setupDecision = decideSetupPhase(gameEnvView, aiPlayerId);
        if (setupDecision) {
            return setupDecision;
        }

        const players = gameEnvView?.players || {};
        const self = players[aiPlayerId];
        if (!self) {
            return { kind: 'wait', reason: 'self_not_found' };
        }

        const choiceDecision = decideChoiceIfPending(gameEnvView, aiPlayerId);
        if (choiceDecision) {
            return choiceDecision;
        }

        const battleDecision = decideActionStepConfirmation(gameEnvView, aiPlayerId);
        if (battleDecision) {
            return battleDecision;
        }

        if (gameEnvView?.currentPlayer !== aiPlayerId) {
            return { kind: 'wait', reason: 'not_my_turn' };
        }

        const opponentId = getOpponentId(gameEnvView, aiPlayerId);
        if (!opponentId || !players[opponentId]) {
            return { kind: 'wait', reason: 'opponent_not_found' };
        }

        const nonAttack = findNonAttackAction(gameEnvView, aiPlayerId);
        if (nonAttack) {
            return nonAttack;
        }

        const winAttack = findWinningShieldAttack(gameEnvView, aiPlayerId, opponentId);
        if (winAttack) {
            return winAttack;
        }

        const unitAttack = findBestUnitAttack(gameEnvView, aiPlayerId, opponentId);
        if (unitAttack) {
            return unitAttack;
        }

        const playCard = findBestPlayCard(gameEnvView, aiPlayerId);
        if (playCard) {
            return playCard;
        }

        const shieldAttack = findSafeShieldAttack(gameEnvView, aiPlayerId);
        if (shieldAttack) {
            return shieldAttack;
        }

        return {
            kind: 'endTurn',
            reason: 'no_better_action'
        };
    }
}
