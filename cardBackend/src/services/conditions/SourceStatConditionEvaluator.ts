import type { GameEnvironment } from '../../models/GameEnvironment';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { PlayerCardManager } from '../PlayerCardManager';

export class SourceStatConditionEvaluator {
    private static matchesNumeric(actual: number, expected: unknown): boolean {
        if (typeof expected === 'number') {
            return actual === expected;
        }
        if (typeof expected === 'string') {
            return validateComparisonFilter(actual, expected);
        }
        return true;
    }

    static sourceHpMatches(gameEnv: GameEnvironment, sourceUnitCarduid: string, expected: unknown): boolean {
        const totals = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, sourceUnitCarduid);
        return this.matchesNumeric(totals.totalHP, expected);
    }

    static sourceApMatches(gameEnv: GameEnvironment, sourceUnitCarduid: string, expected: unknown): boolean {
        const totals = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, sourceUnitCarduid);
        return this.matchesNumeric(totals.totalAP, expected);
    }
}

