// src/services/effects/BattleDestroyGlobalEffectManager.ts
// Handles "global" BATTLE_DESTROY triggered effects that listen to other units' battle destroys.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard, PilotZoneCard, BaseCard } from '../../models/CardSystem';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { EffectExecutor } from './EffectExecutor';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { EffectUsageTracker } from './EffectUsageTracker';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { DeployTargetManager } from '../DeployTargetManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { getEffectEventTrigger } from './timing/EffectTimingAccess';

type SlotCard = { card: UnitZoneCard | PilotZoneCard | BaseCard; slotName: string };

export interface BattleDestroyGlobalContext {
    sourcePlayerId: string;
    sourceSlot: string;
    destroyedPlayerId: string;
    destroyedSlot: string;
    sourceUnit: UnitZoneCard;
    destroyedUnit: UnitZoneCard;
}

export class BattleDestroyGlobalEffectManager {
    static processGlobalBattleDestroyEffects(
        gameEnv: GameEnvironment,
        context: BattleDestroyGlobalContext
    ): { success: boolean; error?: string } {
        // These effects are defined as "during your turn" global listeners (e.g. GD02-002),
        // so only evaluate for the current player.
        if (gameEnv.currentPlayer !== context.sourcePlayerId) {
            return { success: true };
        }

        const player = gameEnv.getPlayer(context.sourcePlayerId);
        if (!player?.zones) {
            return { success: true };
        }

        const candidates: SlotCard[] = [];
        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit) {
                candidates.push({ card: slot.unit as UnitZoneCard, slotName });
            }
            if (slot?.pilot) {
                candidates.push({ card: slot.pilot as PilotZoneCard, slotName });
            }
        }
        const bases = Array.isArray((player.zones as any).base) ? (player.zones as any).base : [];
        for (const base of bases) {
            if (base?.carduid) {
                candidates.push({ card: base as BaseCard, slotName: 'base' });
            }
        }

        for (const { card, slotName } of candidates) {
            const effects = EffectRuleCatalog.collectEffects(card.cardData, {
                trigger: 'BATTLE_DESTROY',
                fallbackEffectId: 'battle_destroy_global',
                expectedTriggers: ['BATTLE_DESTROY'],
                requireAction: true,
                defaultTargetScope: 'self'
            });

            for (const effectRule of effects) {
                const normalized = ensureEffectDefaults({ ...effectRule }) as EffectDefinition;

                if (!this.isBattleDestroyTrigger(normalized)) {
                    continue;
                }
                if (!this.isGlobalBattleDestroyListener(normalized)) {
                    continue;
                }

                // Link/Pair checks etc
                if (!ContinuousEffectManager.sourceConditionsMet(normalized, card as any, gameEnv, context.sourcePlayerId)) {
                    continue;
                }

                const nonEventConditions = Array.isArray(normalized.conditions)
                    ? normalized.conditions.filter((c: any) => c?.type !== 'battleDestroyEvent')
                    : undefined;

                const normalizedWithoutBattleDestroyEvent = ensureEffectDefaults({
                    ...normalized,
                    conditions: nonEventConditions
                } as any);

                // Evaluate all standard conditions (phase/turn/pairedPilotTrait/etc); event-specific checks handled below.
                if (!ContinuousEffectManager.validateEffectConditions(
                    normalizedWithoutBattleDestroyEvent,
                    gameEnv,
                    context.sourcePlayerId,
                    card as any
                )) {
                    continue;
                }

                // Event conditions (battleDestroyEvent) must match the incoming destroy context
                if (!this.battleDestroyEventConditionsSatisfied(normalized.conditions, context, context.sourcePlayerId)) {
                    continue;
                }

                // Once per turn restriction
                const restrictions = Array.isArray((normalized as any).restrictions) ? ((normalized as any).restrictions as unknown[]) : [];
                const usageKey = EffectUsageTracker.getUsageKey(normalized, 'battle_destroy');
                if (restrictions.includes('once_per_turn')) {
                    if (!EffectUsageTracker.canUseOncePerTurn(card as any, usageKey, gameEnv.currentTurn)) {
                        continue;
                    }
                }

                const forcedTargets = this.resolveForcedTargetsFromBattleContext(normalized, context);
                if (forcedTargets) {
                    const resolvedTargets = forcedTargets.filter((target) => !!SlotZoneUtils.resolveTargetReference(gameEnv, target));
                    if (resolvedTargets.length === 0) {
                        console.log(`ℹ️ Skipping global BATTLE_DESTROY ${normalized.effectId || 'unknown'}: forced event target no longer exists`);
                        continue;
                    }
                    const result = EffectExecutor.applyEffectToTargets(
                        gameEnv,
                        normalized,
                        resolvedTargets,
                        context.sourcePlayerId,
                        card.carduid
                    );
                    if (!result.success) {
                        if (this.isMissingTargetError(result.error)) {
                            console.log(`ℹ️ Skipping global BATTLE_DESTROY ${normalized.effectId || 'unknown'}: ${result.error}`);
                            continue;
                        }
                        return { success: false, error: result.error || `Failed to apply BATTLE_DESTROY global effect ${normalized.effectId}` };
                    }
                } else {
                    const result = DeployTargetManager.processEffectWithTargetChoice(
                        gameEnv,
                        context.sourcePlayerId,
                        card.carduid,
                        normalized
                    );
                    if (!result.success) {
                        return { success: false, error: result.error || `Failed to apply BATTLE_DESTROY global effect ${normalized.effectId}` };
                    }
                }

                if (restrictions.includes('once_per_turn')) {
                    EffectUsageTracker.markUsedThisTurn(card as any, usageKey, gameEnv.currentTurn);
                }
            }
        }

        return { success: true };
    }

    private static resolveForcedTargetsFromBattleContext(
        effect: EffectDefinition,
        context: BattleDestroyGlobalContext
    ): TargetReference[] | null {
        const targetFilters = effect.target?.filters && typeof effect.target.filters === 'object'
            ? (effect.target.filters as Record<string, unknown>)
            : {};

        if (targetFilters.isEventAttacker === true) {
            return [{
                playerId: context.sourcePlayerId,
                zone: context.sourceSlot,
                carduid: context.sourceUnit.carduid
            }];
        }
        if (targetFilters.isEventDefender === true) {
            return [{
                playerId: context.destroyedPlayerId,
                zone: context.destroyedSlot,
                carduid: context.destroyedUnit.carduid
            }];
        }

        return null;
    }

    private static isBattleDestroyTrigger(effect: EffectDefinition): boolean {
        return effect.type === 'triggered' && getEffectEventTrigger(effect) === 'BATTLE_DESTROY';
    }

    private static isGlobalBattleDestroyListener(effect: EffectDefinition): boolean {
        const hasBattleDestroyEventCondition = Array.isArray(effect.conditions)
            && effect.conditions.some((entry) => entry && typeof entry === 'object' && (entry as Record<string, unknown>).type === 'battleDestroyEvent');
        const filters = effect.target?.filters && typeof effect.target.filters === 'object'
            ? (effect.target.filters as Record<string, unknown>)
            : {};
        const targetsEventCard = filters.isEventAttacker === true || filters.isEventDefender === true;
        return hasBattleDestroyEventCondition || targetsEventCard;
    }

    private static isMissingTargetError(error?: string): boolean {
        return typeof error === 'string' && /^Target card .+ not found in zone .+$/i.test(error);
    }

    private static battleDestroyEventConditionsSatisfied(
        conditions: unknown,
        context: BattleDestroyGlobalContext,
        ownerPlayerId: string
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return true;
        }

        for (const raw of conditions) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }

            const typed = raw as Record<string, unknown>;
            const type = typeof typed.type === 'string' ? typed.type : '';
            if (type !== 'battleDestroyEvent') {
                continue;
            }

            const sourceController = typeof typed.sourceController === 'string' ? typed.sourceController : 'self';
            const destroyedController = typeof typed.destroyedController === 'string' ? typed.destroyedController : 'opponent';
            const sourceCardType = typeof typed.sourceCardType === 'string' ? typed.sourceCardType : 'unit';
            const destroyedCardType = typeof typed.destroyedCardType === 'string' ? typed.destroyedCardType : 'unit';
            const damageType = typeof typed.damageType === 'string' ? typed.damageType : 'battle';
            const sourceTraitsAny = Array.isArray(typed.sourceTraitsAny)
                ? typed.sourceTraitsAny.filter((trait): trait is string => typeof trait === 'string')
                : [];
            const sourceLevel = typed.sourceLevel;

            if (damageType !== 'battle') {
                return false;
            }
            if (sourceCardType !== 'unit' || destroyedCardType !== 'unit') {
                return false;
            }

            if (sourceController === 'self' && context.sourcePlayerId !== ownerPlayerId) {
                return false;
            }
            if (sourceController === 'opponent' && context.sourcePlayerId === ownerPlayerId) {
                return false;
            }

            if (destroyedController === 'opponent' && context.destroyedPlayerId === ownerPlayerId) {
                return false;
            }
            if (destroyedController === 'self' && context.destroyedPlayerId !== ownerPlayerId) {
                return false;
            }

            if (sourceTraitsAny.length > 0) {
                const sourceCardTraits = Array.isArray(context.sourceUnit.cardData?.traits)
                    ? context.sourceUnit.cardData.traits
                    : [];
                const hasAnyTrait = sourceTraitsAny.some((trait) => sourceCardTraits.includes(trait));
                if (!hasAnyTrait) {
                    return false;
                }
            }

            const attackerLevel = typeof context.sourceUnit.cardData?.level === 'number' ? context.sourceUnit.cardData.level : 0;
            if (typeof sourceLevel === 'number' && attackerLevel !== sourceLevel) {
                return false;
            }
            if (typeof sourceLevel === 'string') {
                if (!validateComparisonFilter(attackerLevel, sourceLevel)) {
                    return false;
                }
            }
        }

        return true;
    }
}
