// src/services/effects/BattleDestroyEffectManager.ts
// Handles BATTLE_DESTROY triggered effects after battle damage is calculated

import { GameEnvironment } from '../../models/GameEnvironment';
import { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { EffectExecutor } from './EffectExecutor';
import { DelayedTriggerManager } from './DelayedTriggerManager';
import { TriggeredEffectProcessor } from './TriggeredEffectProcessor';
import { BattleDestroyGlobalEffectManager } from './BattleDestroyGlobalEffectManager';

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
            const processed = TriggeredEffectProcessor.processForSourceCard(gameEnv, sourcePlayerId, sourceCard as any, {
                trigger: 'BATTLE_DESTROY',
                expectedTriggers: ['BATTLE_DESTROY'],
                fallbackEffectId: 'battle_destroy',
                defaultTargetScope: 'self'
            });

            if (!processed.success) {
                return { success: false, error: processed.error };
            }
        }

        const globalResult = BattleDestroyGlobalEffectManager.processGlobalBattleDestroyEffects(gameEnv, {
            sourcePlayerId: context.sourcePlayerId,
            destroyedPlayerId: context.destroyedPlayerId,
            sourceUnit: context.sourceUnit,
            destroyedUnit: context.destroyedUnit
        });
        if (!globalResult.success) {
            return { success: false, error: globalResult.error };
        }

        const delayedResult = DelayedTriggerManager.handleBattleDestroy(gameEnv, context);
        if (!delayedResult.success) {
            return {
                success: false,
                error: delayedResult.error || 'Failed to resolve delayed trigger(s) on battle destroy'
            };
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
