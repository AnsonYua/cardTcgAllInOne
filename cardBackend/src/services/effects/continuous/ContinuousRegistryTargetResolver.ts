// src/services/effects/continuous/ContinuousRegistryTargetResolver.ts
// Centralizes registry target resolution for tricky scopes (like pilot "self" targeting its linked unit).

import type { GameEnvironment } from '../../../models/GameEnvironment';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';

export class ContinuousRegistryTargetResolver {
    static resolveSelf(effectEntry: any, gameEnv: GameEnvironment): any[] {
        const desiredType = typeof effectEntry?.effectData?.target?.type === 'string'
            ? effectEntry.effectData.target.type.toLowerCase()
            : '';

        const lookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, effectEntry.sourceCarduid);
        if (!lookup.found) {
            return [];
        }

        if (desiredType === 'unit') {
            if (lookup.type === 'unit' && lookup.unit) {
                return [lookup.unit];
            }
            if (lookup.type === 'pilot' && lookup.unit) {
                return [lookup.unit];
            }
            return [];
        }

        if (desiredType === 'pilot') {
            if (lookup.type === 'pilot' && lookup.pilot) {
                return [lookup.pilot];
            }
            if (lookup.type === 'unit' && lookup.pilot) {
                return [lookup.pilot];
            }
            return [];
        }

        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, effectEntry.sourceCarduid);
        return sourceCard ? [sourceCard] : [];
    }

    static resolveBattleOpponent(effectEntry: any, gameEnv: GameEnvironment): any[] {
        const battle = gameEnv.currentBattle;
        if (!battle || battle.actionType !== 'attackUnit') {
            return [];
        }

        const attackerCarduid = battle.attackerCarduid;
        const targetCarduid = battle.targetCarduid;
        if (!attackerCarduid || !targetCarduid) {
            return [];
        }

        const sourceCarduid = effectEntry.sourceCarduid;
        if (sourceCarduid === targetCarduid) {
            const attacker = SlotZoneUtils.getCardByUid(gameEnv, attackerCarduid);
            return attacker ? [attacker] : [];
        }

        if (sourceCarduid === attackerCarduid) {
            const defender = SlotZoneUtils.getCardByUid(gameEnv, targetCarduid);
            return defender ? [defender] : [];
        }

        return [];
    }
}
