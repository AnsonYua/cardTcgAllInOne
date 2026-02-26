// src/services/battle/BattleBaseDamagePreventionUtils.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard, BaseCard } from '../../models/CardSystem';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { EffectRuleCatalog } from '../effects/EffectRuleCatalog';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { EffectExecutor } from '../effects/EffectExecutor';

export class BattleBaseDamagePreventionUtils {
    static isBaseDamagePreventedFromEnemyUnit(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        baseCard: BaseCard,
        attackingUnit: UnitZoneCard
    ): boolean {
        const tempEffects = (baseCard as any)?.temporaryEffects;
        if (Array.isArray(tempEffects) && tempEffects.length > 0) {
            const enemyLevel = typeof attackingUnit.cardData?.level === 'number' ? attackingUnit.cardData.level : 0;
            const enemyAp = typeof attackingUnit.cardData?.ap === 'number'
                ? attackingUnit.cardData.ap
                : ((attackingUnit as any).originalAP || 0);
            const enemyHp = Math.max(0, (attackingUnit.cardData?.hp || 0) - ((attackingUnit as any).damageReceived || 0));

            const preventedByTemporary = tempEffects.some((tempEffect: any) => {
                const prevention = tempEffect?.preventBattleDamage;
                if (!prevention || typeof prevention !== 'object') {
                    return false;
                }

                const from = typeof prevention.from === 'string' ? prevention.from : undefined;
                if (from && from !== 'enemy_units') {
                    return false;
                }

                if (typeof prevention.enemyLevel === 'string' && !validateComparisonFilter(enemyLevel, prevention.enemyLevel)) {
                    return false;
                }

                if (typeof prevention.enemyAp === 'string' && !validateComparisonFilter(enemyAp, prevention.enemyAp)) {
                    return false;
                }

                if (typeof prevention.enemyHp === 'string' && !validateComparisonFilter(enemyHp, prevention.enemyHp)) {
                    return false;
                }

                if (
                    typeof prevention.enemyLevel !== 'string'
                    && typeof prevention.enemyAp !== 'string'
                    && typeof prevention.enemyHp !== 'string'
                    && from !== 'enemy_units'
                ) {
                    return false;
                }

                return true;
            });

            if (preventedByTemporary) {
                return true;
            }
        }

        const effects = EffectRuleCatalog.collectEffects(baseCard.cardData, {
            trigger: 'continuous',
            fallbackEffectId: 'base_continuous_effect',
            expectedTriggers: ['continuous'],
            requireAction: true,
            defaultTargetScope: 'self'
        }).map(effect => ensureEffectDefaults(effect));

        const attackIsToken =
            attackingUnit?.cardData?.color === 'Token'
            || (typeof attackingUnit?.cardData?.id === 'string' && attackingUnit.cardData.id.startsWith('T-'));

        for (const effect of effects) {
            const action = EffectExecutor.getEffectAction(effect);
            if (action !== 'prevent_damage') {
                continue;
            }

            if (!ContinuousEffectManager.validateEffectConditions(effect, gameEnv, defendingPlayerId, baseCard as any)) {
                continue;
            }

            const from = typeof effect.parameters?.from === 'string' ? effect.parameters.from : undefined;
            if (from && from !== 'enemy_units') {
                continue;
            }

            if (attackIsToken) {
                continue;
            }

            const enemyLevelFilter = typeof effect.parameters?.enemyLevel === 'string' ? effect.parameters.enemyLevel : undefined;
            if (enemyLevelFilter) {
                const enemyLevel = typeof attackingUnit.cardData?.level === 'number' ? attackingUnit.cardData.level : 0;
                if (!validateComparisonFilter(enemyLevel, enemyLevelFilter)) {
                    continue;
                }
            }

            return true;
        }

        return false;
    }
}
