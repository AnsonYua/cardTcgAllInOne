import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import type { SourceLevelScope } from '../EventQueue/interfaces/GameEvent';

/**
 * Resolves "this Unit" level semantics for source-card driven conditions/filters.
 * If source is a pilot paired with a unit, use paired unit level.
 * Otherwise use source card's own level.
 */
export class EffectiveSourceLevelResolver {
    static resolve(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        sourceLevelScope: SourceLevelScope = 'paired_unit'
    ): number | null {
        if (!sourceCarduid) {
            return null;
        }

        const sourceLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (!sourceLookup.found) {
            return null;
        }

        if (sourceLevelScope === 'paired_unit' && sourceLookup.type === 'pilot' && sourceLookup.unit?.cardData) {
            const pairedUnitLevel = sourceLookup.unit.cardData.level;
            if (typeof pairedUnitLevel === 'number') {
                return pairedUnitLevel;
            }
        }

        const sourceCard = sourceLookup.card || sourceLookup.unit || sourceLookup.pilot;
        const sourceLevel = sourceCard?.cardData?.level;
        return typeof sourceLevel === 'number' ? sourceLevel : null;
    }
}
