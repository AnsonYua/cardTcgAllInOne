// src/services/conditions/BattleConditionEvaluator.ts
// Centralizes battle-context condition evaluation (used by ContinuousEffectManager).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';

export class BattleConditionEvaluator {
    static evaluateBattleOpponentLevel(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        comparison: unknown
    ): boolean {
        const battle = gameEnv.currentBattle;
        if (!battle || battle.actionType !== 'attackUnit') {
            return false;
        }

        const attackerUid = typeof battle.attackerCarduid === 'string' ? battle.attackerCarduid : '';
        const targetUid = typeof battle.targetCarduid === 'string' ? battle.targetCarduid : '';

        let opponentUid = '';
        if (sourceCarduid === attackerUid) {
            opponentUid = targetUid;
        } else if (sourceCarduid === targetUid) {
            opponentUid = attackerUid;
        } else {
            return false;
        }

        const opponentCard = opponentUid ? SlotZoneUtils.getCardByUid(gameEnv, opponentUid) : null;
        const opponentLevel = typeof opponentCard?.cardData?.level === 'number' ? opponentCard.cardData.level : 0;

        if (typeof comparison === 'number') {
            return opponentLevel === comparison;
        }
        if (typeof comparison === 'string') {
            return validateComparisonFilter(opponentLevel, comparison);
        }

        // Unknown comparison format: default allow if present
        return true;
    }
}
