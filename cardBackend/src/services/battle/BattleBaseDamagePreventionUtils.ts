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

