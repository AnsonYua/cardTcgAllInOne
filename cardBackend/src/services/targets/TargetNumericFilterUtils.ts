import type { GameEnvironment } from '../../models/GameEnvironment';
import type { PilotZoneCard, UnitZoneCard } from '../../models/CardSystem';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { PlayerCardManager } from '../PlayerCardManager';

export type NumericFilterResult = {
    ok: boolean;
    actual: number;
};

export class TargetNumericFilterUtils {
    static evaluateApFilter(
        gameEnv: GameEnvironment,
        card: UnitZoneCard | PilotZoneCard,
        apFilter: unknown
    ): NumericFilterResult {
        const cardType = typeof (card as any)?.cardData?.cardType === 'string'
            ? String((card as any).cardData.cardType)
            : '';
        const actual = cardType === 'unit'
            ? PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, card.carduid).totalAP
            : (typeof (card as any)?.cardData?.ap === 'number' ? (card as any).cardData.ap : 0);

        if (typeof apFilter === 'number') {
            return {
                ok: actual === apFilter,
                actual
            };
        }

        if (typeof apFilter === 'string') {
            return {
                ok: validateComparisonFilter(actual, apFilter),
                actual
            };
        }

        return { ok: true, actual };
    }
}

