import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard } from '../../models/CardSystem';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { EffectUsageTracker } from './EffectUsageTracker';

type TriggeredEffectWithRestrictions = EffectDefinition & { restrictions?: string[] };

export interface CollectedTriggeredEffect {
    effect: EffectDefinition;
    oncePerTurn?: boolean;
    usageKey?: string;
}

export class StatChangeTriggeredEffectCollector {
    static collectApReducedByEnemyEffect(
        gameEnv: GameEnvironment,
        params: {
            targetCarduid: string;
            targetPlayerId: string;
            sourcePlayerId: string;
        }
    ): { success: boolean; effects: CollectedTriggeredEffect[]; error?: string } {
        const { targetCarduid, targetPlayerId, sourcePlayerId } = params;

        if (!targetCarduid || !targetPlayerId || !sourcePlayerId) {
            return { success: true, effects: [] };
        }

        if (targetPlayerId === sourcePlayerId) {
            return { success: true, effects: [] };
        }

        const resolvedTarget = SlotZoneUtils.getCardByUid(gameEnv, targetCarduid) as UnitZoneCard | null;
        if (!resolvedTarget) {
            return { success: true, effects: [] };
        }

        const isUnit = (resolvedTarget as any)?.cardData?.cardType === 'unit';
        if (!isUnit) {
            return { success: true, effects: [] };
        }

        const collected = EffectRuleCatalog.collectEffects((resolvedTarget as any).cardData, {
            trigger: 'AP_REDUCED_BY_ENEMY_EFFECT',
            fallbackEffectId: 'ap_reduced_by_enemy_effect',
            expectedTriggers: ['AP_REDUCED_BY_ENEMY_EFFECT'],
            requireAction: true,
            defaultTargetScope: 'self'
        }) as TriggeredEffectWithRestrictions[];

        if (collected.length === 0) {
            return { success: true, effects: [] };
        }

        const effects: CollectedTriggeredEffect[] = [];

        for (const effect of collected) {
            const normalized = ensureEffectDefaults({ ...effect }) as TriggeredEffectWithRestrictions;

            if (!ContinuousEffectManager.sourceConditionsMet(normalized, resolvedTarget as any, gameEnv, targetPlayerId)) {
                continue;
            }

            if (!ContinuousEffectManager.validateEffectConditions(normalized, gameEnv, targetPlayerId, resolvedTarget as any)) {
                continue;
            }

            const restrictions = Array.isArray(normalized.restrictions) ? normalized.restrictions : [];
            const usageKey = EffectUsageTracker.getUsageKey(normalized, 'ap_reduced_by_enemy_effect');
            const oncePerTurn = restrictions.includes('once_per_turn');
            if (oncePerTurn) {
                if (!EffectUsageTracker.canUseOncePerTurn(resolvedTarget as any, usageKey, gameEnv.currentTurn)) {
                    continue;
                }
            }

            effects.push({
                effect: normalized,
                ...(oncePerTurn ? { oncePerTurn: true, usageKey } : {})
            });
        }

        return { success: true, effects };
    }
}
