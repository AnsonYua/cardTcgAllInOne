// src/services/effects/BattleDestroyGlobalEffectManager.ts
// Handles "global" BATTLE_DESTROY triggered effects that listen to other units' battle destroys.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { EffectExecutor } from './EffectExecutor';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { EffectUsageTracker } from './EffectUsageTracker';

type SlotCard = { card: UnitZoneCard | PilotZoneCard; slotName: string };

export interface BattleDestroyGlobalContext {
    sourcePlayerId: string;
    destroyedPlayerId: string;
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

                // GD02-002 expects "set this unit as active" (self).
                const action = EffectExecutor.getEffectAction(normalized);
                if (action !== 'setActive') {
                    continue;
                }

                const targetRef: TargetReference = {
                    playerId: context.sourcePlayerId,
                    zone: slotName,
                    carduid: card.carduid
                };

                const result = EffectExecutor.applyEffectToTargets(
                    gameEnv,
                    normalized,
                    [targetRef],
                    context.sourcePlayerId,
                    card.carduid
                );
                if (!result.success) {
                    return { success: false, error: result.error || `Failed to apply BATTLE_DESTROY global effect ${normalized.effectId}` };
                }

                if (restrictions.includes('once_per_turn')) {
                    EffectUsageTracker.markUsedThisTurn(card as any, usageKey, gameEnv.currentTurn);
                }
            }
        }

        return { success: true };
    }

    private static isBattleDestroyTrigger(effect: EffectDefinition): boolean {
        return (
            effect.type === 'triggered' &&
            typeof effect.trigger === 'string' &&
            effect.trigger.toUpperCase() === 'BATTLE_DESTROY'
        );
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
        }

        return true;
    }
}
