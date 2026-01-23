// src/services/conditions/PairedSlotConditionEvaluator.ts
// Helper for evaluating conditions that depend on the paired slot context (unit+pilot).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { CardTraitUtils } from '../../utils/CardTraitUtils';

export class PairedSlotConditionEvaluator {
    static pairedPilotColor(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        expectedColor: string
    ): boolean {
        if (!sourceCarduid || !expectedColor) {
            return false;
        }

        const search = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (!search.found) {
            return false;
        }

        const pilotColor = typeof search.pilot?.cardData?.color === 'string' ? search.pilot.cardData.color : '';
        return pilotColor.toLowerCase() === expectedColor.toLowerCase();
    }

    static pairedUnitColor(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        expectedColor: string
    ): boolean {
        if (!sourceCarduid || !expectedColor) {
            return false;
        }

        const search = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (!search.found) {
            return false;
        }

        const unitColor = typeof search.unit?.cardData?.color === 'string' ? search.unit.cardData.color : '';
        return unitColor.toLowerCase() === expectedColor.toLowerCase();
    }

    static pairedUnitTrait(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        expectedTrait: string
    ): boolean {
        if (!sourceCarduid || !expectedTrait) {
            return false;
        }

        const search = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (!search.found) {
            return false;
        }

        return CardTraitUtils.hasTrait(search.unit?.cardData, expectedTrait);
    }
}
