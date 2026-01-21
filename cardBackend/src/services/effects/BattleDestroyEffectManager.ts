// src/services/effects/BattleDestroyEffectManager.ts
// Handles BATTLE_DESTROY triggered effects after battle damage is calculated

import { GameEnvironment } from '../../models/GameEnvironment';
import { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { DeployTargetManager } from '../DeployTargetManager';
import { EffectExecutor } from './EffectExecutor';

export interface BattleDestroyContext {
    sourcePlayerId: string;
    sourceUnit: UnitZoneCard;
    sourceSlot: string;
    destroyedPlayerId: string;
    destroyedUnit: UnitZoneCard;
}

export class BattleDestroyEffectManager {
    static processBattleDestroy(
        gameEnv: GameEnvironment,
        context: BattleDestroyContext
    ): { success: boolean; error?: string } {
        const { sourcePlayerId, sourceUnit, sourceSlot } = context;

        const slotResult = SlotZoneUtils.getSlotZone(gameEnv.players[sourcePlayerId].zones, sourceSlot);
        const pairedPilot = slotResult.isValid ? (slotResult.slot?.pilot as PilotZoneCard | undefined) : undefined;
        const effectSources: Array<UnitZoneCard | PilotZoneCard> = [sourceUnit];
        if (pairedPilot) {
            effectSources.push(pairedPilot);
        }

        for (const sourceCard of effectSources) {
            const effects = EffectRuleCatalog.collectEffects(sourceCard.cardData, {
                trigger: 'BATTLE_DESTROY',
                fallbackEffectId: 'battle_destroy',
                expectedTriggers: ['BATTLE_DESTROY']
            });

            for (const effect of effects) {
                const normalized = ensureEffectDefaults({ ...effect });

                if (!ContinuousEffectManager.sourceConditionsMet(normalized, sourceCard as any, gameEnv, sourcePlayerId)) {
                    continue;
                }

                if (!ContinuousEffectManager.validateEffectConditions(normalized, gameEnv, sourcePlayerId, sourceCard as any)) {
                    continue;
                }

                const action = EffectExecutor.getEffectAction(normalized);
                if (!action) {
                    continue;
                }

                const result = EffectExecutor.actionSupportsNoTargets(action)
                    ? EffectExecutor.applyEffectToTargets(gameEnv, normalized, [], sourcePlayerId, sourceCard.carduid)
                    : DeployTargetManager.processEffectWithTargetChoice(
                          gameEnv,
                          sourcePlayerId,
                          sourceCard.carduid,
                          normalized
                      );

                if (!result.success) {
                    return { success: false, error: result.error || `Failed to apply ${normalized.effectId}` };
                }
            }
        }

        const breachValue = this.getTemporaryBreachValue(sourceUnit);
        if (breachValue > 0) {
            const breachEffect: EffectDefinition = {
                effectId: 'granted_breach',
                trigger: 'BATTLE_DESTROY',
                action: 'damageShield',
                target: {
                    type: 'card',
                    scope: 'opponent_shield',
                    count: 1
                },
                parameters: {
                    value: breachValue
                }
            };

            const breachResult = EffectExecutor.applyEffectToTargets(
                gameEnv,
                breachEffect,
                [],
                sourcePlayerId,
                sourceUnit.carduid
            );

            if (!breachResult.success) {
                return { success: false, error: breachResult.error || 'Failed to apply breach damage' };
            }
        }

        return { success: true };
    }

    private static getTemporaryBreachValue(unit: UnitZoneCard): number {
        if (!Array.isArray(unit.temporaryEffects)) {
            return 0;
        }

        return unit.temporaryEffects.reduce((total, effect) => {
            const value = typeof effect.breachValue === 'number' ? effect.breachValue : 0;
            return total + value;
        }, 0);
    }
}
