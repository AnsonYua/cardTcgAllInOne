// src/services/battle/BattleDamagePreventionUtils.ts

import type { UnitZoneCard } from '../../models/CardSystem';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';

export class BattleDamagePreventionUtils {
    static isBattleDamagePrevented(
        receivingUnit: UnitZoneCard,
        enemyUnit: UnitZoneCard,
        enemyUnitTotalAp: number,
        enemyUnitTotalHp?: number
    ): boolean {
        const tempEffects = (receivingUnit as any).temporaryEffects;
        if (!Array.isArray(tempEffects) || tempEffects.length === 0) {
            return false;
        }

        const enemyLevel = typeof enemyUnit.cardData?.level === 'number' ? enemyUnit.cardData.level : 0;

        return tempEffects.some((tempEffect: any) => {
            const prevention = tempEffect?.preventBattleDamage;
            if (!prevention || typeof prevention !== 'object') {
                return false;
            }

            const from = typeof prevention.from === 'string' ? prevention.from : undefined;
            if (from && from !== 'enemy_units') {
                return false;
            }

            if (typeof prevention.enemyLevel === 'string') {
                if (!validateComparisonFilter(enemyLevel, prevention.enemyLevel)) {
                    return false;
                }
            }

            if (typeof prevention.enemyAp === 'string') {
                if (!validateComparisonFilter(enemyUnitTotalAp, prevention.enemyAp)) {
                    return false;
                }
            } else if (typeof prevention.maxEnemyAp === 'number') {
                if (enemyUnitTotalAp > prevention.maxEnemyAp) {
                    return false;
                }
            }

            if (typeof prevention.enemyHp === 'string') {
                const hpValue = typeof enemyUnitTotalHp === 'number'
                    ? enemyUnitTotalHp
                    : Math.max(0, (enemyUnit.cardData?.hp || 0) - ((enemyUnit as any).damageReceived || 0));
                if (!validateComparisonFilter(hpValue, prevention.enemyHp)) {
                    return false;
                }
            }

            if (
                typeof prevention.enemyLevel !== 'string'
                && typeof prevention.enemyAp !== 'string'
                && typeof prevention.enemyHp !== 'string'
                && typeof prevention.maxEnemyAp !== 'number'
                && from !== 'enemy_units'
            ) {
                return false;
            }

            return true;
        });
    }
}
