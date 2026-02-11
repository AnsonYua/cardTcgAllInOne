import type { GameEnvironment } from '../../../models/GameEnvironment';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';

export class DynamicComparisonFilterResolver {
    static resolve(
        rawFilter: string,
        gameEnv: GameEnvironment,
        sourceCarduid?: string
    ): string | null {
        if (!rawFilter) {
            return null;
        }

        if (!rawFilter.includes('SOURCE_LEVEL')) {
            return rawFilter;
        }

        const match = rawFilter.match(/^(<=|>=|<|>|==|!=)SOURCE_LEVEL$/);
        if (!match) {
            console.log(`⚠️ Unsupported dynamic comparison filter: ${rawFilter}`);
            return null;
        }

        if (!sourceCarduid) {
            console.log(`⚠️ Cannot resolve ${rawFilter} without sourceCarduid`);
            return null;
        }

        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) as any;
        const sourceLevel = typeof sourceCard?.cardData?.level === 'number' ? (sourceCard.cardData.level as number) : null;
        if (sourceLevel === null) {
            console.log(`⚠️ Cannot resolve ${rawFilter}: source ${sourceCarduid} has no level`);
            return null;
        }

        return `${match[1]}${sourceLevel}`;
    }
}

