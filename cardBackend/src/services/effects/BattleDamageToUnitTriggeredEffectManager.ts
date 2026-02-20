import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard } from '../../models/CardSystem';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { ensureEffectDefaults, validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { EffectExecutor } from './EffectExecutor';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { EffectUsageTracker } from './EffectUsageTracker';
import { DeployTargetManager } from '../DeployTargetManager';

type SourceCard = any;

export interface BattleDamageToUnitContext {
    attackingPlayerId: string;
    defendingPlayerId: string;
    attackerSlot: string;
    defenderSlot: string;
    sourceUnit: UnitZoneCard;
    targetUnit: UnitZoneCard;
    damage: number;
}

export class BattleDamageToUnitTriggeredEffectManager {
    static process(
        gameEnv: GameEnvironment,
        context: BattleDamageToUnitContext
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        if (!context.sourceUnit?.carduid || !context.targetUnit?.carduid || context.damage <= 0) {
            return { success: true };
        }

        const player = gameEnv.getPlayer(context.attackingPlayerId) || gameEnv.players[context.attackingPlayerId];
        if (!player?.zones) {
            return { success: true };
        }

        const sources: SourceCard[] = [];
        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit) sources.push(slot.unit);
            if (slot?.pilot) sources.push(slot.pilot);
        }
        const bases = Array.isArray((player.zones as any).base) ? (player.zones as any).base : [];
        for (const base of bases) {
            if (base?.carduid) sources.push(base);
        }

        for (const sourceCard of sources) {
            const effects = EffectRuleCatalog.collectEffects(sourceCard.cardData, {
                trigger: 'BATTLE_DAMAGE_TO_UNIT',
                fallbackEffectId: 'battle_damage_to_unit',
                expectedTriggers: ['BATTLE_DAMAGE_TO_UNIT'],
                requireAction: true,
                defaultTargetScope: 'self'
            });

            for (const effectRule of effects) {
                const normalized = ensureEffectDefaults({ ...effectRule }) as EffectDefinition;
                if (!ContinuousEffectManager.sourceConditionsMet(normalized, sourceCard, gameEnv, context.attackingPlayerId)) {
                    continue;
                }

                const nonEventConditions = Array.isArray(normalized.conditions)
                    ? normalized.conditions.filter((c: any) => c?.type !== 'battleDamageToUnitEvent')
                    : undefined;
                const normalizedWithoutEvent = ensureEffectDefaults({
                    ...normalized,
                    conditions: nonEventConditions
                } as EffectDefinition);

                if (!ContinuousEffectManager.validateEffectConditions(
                    normalizedWithoutEvent,
                    gameEnv,
                    context.attackingPlayerId,
                    sourceCard
                )) {
                    continue;
                }

                if (!this.eventConditionsSatisfied(normalized.conditions, context)) {
                    continue;
                }

                const restrictions = Array.isArray((normalized as any).restrictions) ? ((normalized as any).restrictions as unknown[]) : [];
                const usageKey = EffectUsageTracker.getUsageKey(normalized, 'battle_damage_to_unit');
                if (restrictions.includes('once_per_turn')) {
                    if (!EffectUsageTracker.canUseOncePerTurn(sourceCard, usageKey, gameEnv.currentTurn)) {
                        continue;
                    }
                }

                const forcedTargets = this.resolveForcedTargets(normalized, context);
                let result: { success: boolean; error?: string; requiresSelection?: boolean };
                if (forcedTargets) {
                    const applyResult = EffectExecutor.applyEffectToTargets(
                        gameEnv,
                        normalized,
                        forcedTargets,
                        context.attackingPlayerId,
                        sourceCard.carduid
                    );
                    result = { success: applyResult.success, ...(applyResult.error ? { error: applyResult.error } : {}) };
                } else {
                    result = DeployTargetManager.processEffectWithTargetChoice(
                        gameEnv,
                        context.attackingPlayerId,
                        sourceCard.carduid,
                        normalized
                    );
                }

                if (!result.success) {
                    return { success: false, error: result.error || `Failed to apply BATTLE_DAMAGE_TO_UNIT effect ${normalized.effectId}` };
                }

                if (restrictions.includes('once_per_turn')) {
                    EffectUsageTracker.markUsedThisTurn(sourceCard, usageKey, gameEnv.currentTurn);
                }

                if (result.requiresSelection) {
                    return { success: true, requiresSelection: true };
                }
            }
        }

        return { success: true };
    }

    private static resolveForcedTargets(
        effect: EffectDefinition,
        context: BattleDamageToUnitContext
    ): TargetReference[] | null {
        const filters = effect.target?.filters && typeof effect.target.filters === 'object'
            ? (effect.target.filters as Record<string, unknown>)
            : {};
        if (filters.isEventDefender === true) {
            return [{
                playerId: context.defendingPlayerId,
                zone: context.defenderSlot,
                carduid: context.targetUnit.carduid
            }];
        }
        return null;
    }

    private static eventConditionsSatisfied(
        conditions: unknown,
        context: BattleDamageToUnitContext
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return true;
        }

        for (const raw of conditions) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }
            const typed = raw as Record<string, unknown>;
            if (typed.type !== 'battleDamageToUnitEvent') {
                continue;
            }

            const sourceController = typeof typed.sourceController === 'string' ? typed.sourceController : 'self';
            const targetController = typeof typed.targetController === 'string' ? typed.targetController : 'opponent';
            const sourceTraitsAny = Array.isArray(typed.sourceTraitsAny)
                ? typed.sourceTraitsAny.filter((trait): trait is string => typeof trait === 'string')
                : [];
            const sourceLevel = typed.sourceLevel;

            if (sourceController === 'opponent') {
                return false;
            }
            if (targetController === 'opponent' && context.defendingPlayerId === context.attackingPlayerId) {
                return false;
            }
            if (targetController === 'self' && context.defendingPlayerId !== context.attackingPlayerId) {
                return false;
            }

            if (sourceTraitsAny.length > 0) {
                const sourceTraits = Array.isArray(context.sourceUnit.cardData?.traits) ? context.sourceUnit.cardData.traits : [];
                const hasAnyTrait = sourceTraitsAny.some((trait) => sourceTraits.includes(trait));
                if (!hasAnyTrait) {
                    return false;
                }
            }

            const sourceLevelValue = typeof context.sourceUnit.cardData?.level === 'number' ? context.sourceUnit.cardData.level : 0;
            if (typeof sourceLevel === 'number' && sourceLevelValue !== sourceLevel) {
                return false;
            }
            if (typeof sourceLevel === 'string' && !validateComparisonFilter(sourceLevelValue, sourceLevel)) {
                return false;
            }
        }

        return true;
    }
}
