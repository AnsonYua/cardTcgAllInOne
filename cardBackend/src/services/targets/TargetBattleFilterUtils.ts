import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { KeywordUtils } from '../../utils/KeywordUtils';
import type { TargetFilters } from '../EventQueue/interfaces/GameEvent';

export type BattleFilterResult = {
    ok: boolean;
    reason?: string;
};

type SlotContext = {
    slot?: {
        unit?: {
            carduid?: string;
        };
    };
} | null;

export class TargetBattleFilterUtils {
    static validateBattleFilters(
        gameEnv: GameEnvironment,
        filters: TargetFilters,
        slotContext: SlotContext
    ): BattleFilterResult {
        const unitCarduid = slotContext?.slot?.unit?.carduid;
        const battle = gameEnv.currentBattle;

        if (typeof (filters as any).isBattling === 'boolean') {
            const expectedBattling = (filters as any).isBattling === true;
            const isBattling = Boolean(
                unitCarduid &&
                battle &&
                (battle.attackerCarduid === unitCarduid || battle.targetCarduid === unitCarduid)
            );
            if (isBattling !== expectedBattling) {
                return {
                    ok: false,
                    reason: `isBattling: expected ${expectedBattling}, got ${isBattling}`
                };
            }
        }

        if (typeof (filters as any).battleOpponentHasKeyword === 'string') {
            const requiredKeyword = String((filters as any).battleOpponentHasKeyword).trim();
            if (!requiredKeyword || !unitCarduid || !battle || battle.actionType !== 'attackUnit') {
                return { ok: false, reason: 'battleOpponentHasKeyword: missing battle or unit context' };
            }

            const opponentCarduid = battle.attackerCarduid === unitCarduid
                ? battle.targetCarduid
                : battle.targetCarduid === unitCarduid
                    ? battle.attackerCarduid
                    : '';
            if (!opponentCarduid) {
                return { ok: false, reason: 'battleOpponentHasKeyword: source is not part of current battle' };
            }

            const opponentCard = SlotZoneUtils.getCardByUid(gameEnv, opponentCarduid);
            if (!opponentCard || !KeywordUtils.hasKeyword(opponentCard as any, requiredKeyword)) {
                return { ok: false, reason: `battleOpponentHasKeyword: opponent missing ${requiredKeyword}` };
            }
        }

        return { ok: true };
    }
}
