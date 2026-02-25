import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export class BattleOpponentOfSourceTargetResolver {
    static resolve(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        effect: EffectDefinition
    ): TargetReference[] {
        void effect;

        const battle = gameEnv.currentBattle;
        if (!battle || battle.actionType !== 'attackUnit') {
            return [];
        }

        const attackerCarduid = typeof battle.attackerCarduid === 'string' ? battle.attackerCarduid : '';
        const targetCarduid = typeof battle.targetCarduid === 'string' ? battle.targetCarduid : '';
        if (!attackerCarduid || !targetCarduid || !sourceCarduid) {
            return [];
        }

        const opponentCarduid =
            sourceCarduid === attackerCarduid
                ? targetCarduid
                : sourceCarduid === targetCarduid
                    ? attackerCarduid
                    : '';
        if (!opponentCarduid) {
            return [];
        }

        const search = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, opponentCarduid);
        if (!search.found || !search.playerId || !search.slotName || search.type !== 'unit' || !search.unit) {
            return [];
        }

        return [{
            carduid: opponentCarduid,
            zone: search.slotName,
            playerId: search.playerId,
            cardData: search.unit.cardData
        }];
    }
}
