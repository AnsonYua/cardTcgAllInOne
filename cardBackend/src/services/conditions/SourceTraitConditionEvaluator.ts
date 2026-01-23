// src/services/conditions/SourceTraitConditionEvaluator.ts
// Evaluates "sourceTrait" conditions for continuous/sequence-derived effects.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { LinkUtils } from '../../utils/LinkUtils';

export class SourceTraitConditionEvaluator {
    static sourceHasTrait(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        trait: string
    ): boolean {
        if (!trait) {
            return false;
        }

        const lookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (!lookup.found || !lookup.playerId) {
            return false;
        }

        if (lookup.type === 'unit' && lookup.unit?.cardData) {
            const traits = Array.isArray(lookup.unit.cardData.traits) ? lookup.unit.cardData.traits : [];
            return traits.includes(trait);
        }

        if (lookup.type === 'pilot' && lookup.pilot?.cardData) {
            const unit = lookup.unit;
            const pilot = lookup.pilot;
            if (!unit?.cardData || !LinkUtils.isLinkedPair(unit as any, pilot as any)) {
                return false;
            }
            const traits = Array.isArray(unit.cardData.traits) ? unit.cardData.traits : [];
            return traits.includes(trait);
        }

        return false;
    }
}

