import { GameEnvironment } from '../../models/GameEnvironment';
import { ZoneCard } from '../../models/CardSystem';
import { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { DeployTargetManager } from '../DeployTargetManager';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { EffectUsageTracker } from './EffectUsageTracker';

type PairingGlobalContext = {
    pairedUnitColor?: string;
};

type EffectWithRestrictions = EffectDefinition & { restrictions?: string[] };

export class PairingGlobalEffectManager {
    static enqueueGlobalPairingTriggeredEffects(
        gameEnv: GameEnvironment,
        playerId: string,
        pairingContext: PairingGlobalContext
    ): { success: boolean; error?: string; effectsQueued?: number } {
        try {
            if (!playerId) {
                return { success: false, error: 'No playerId provided' };
            }

            const player = gameEnv.getPlayer(playerId);
            if (!player?.zones) {
                return { success: false, error: `Player ${playerId} zones not found` };
            }

            const sources: ZoneCard[] = [];
            for (const slotName of SLOT_ZONES) {
                const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
                if (!slotResult.isValid || !slotResult.slot?.unit?.carduid) {
                    continue;
                }
                sources.push(slotResult.slot.unit as ZoneCard);
            }

            let effectsQueued = 0;

            for (const sourceCard of sources) {
                const effects = EffectRuleCatalog.collectEffects(sourceCard.cardData as any, {
                    trigger: 'PAIRING_COMPLETE_GLOBAL',
                    fallbackEffectId: 'pairing_complete_global',
                    expectedTriggers: ['PAIRING_COMPLETE_GLOBAL'],
                    requireAction: true,
                    defaultTargetScope: 'opponent'
                });

                for (const effect of effects) {
                    if (effect.type && String(effect.type).toLowerCase() !== 'triggered') {
                        continue;
                    }

                    const normalizedEffect = ensureEffectDefaults({ ...effect }) as EffectWithRestrictions;
                    const usageKey = EffectUsageTracker.getUsageKey(normalizedEffect, 'pairing_complete_global');

                    if (!this.sourceConditionsSatisfied(normalizedEffect, sourceCard, gameEnv, playerId)) {
                        continue;
                    }

                    if (!this.timingAllowsTrigger(normalizedEffect, gameEnv, playerId)) {
                        continue;
                    }

                    if (!this.restrictionsAllowUse(normalizedEffect, sourceCard, usageKey, gameEnv.currentTurn)) {
                        continue;
                    }

                    if (!this.pairingContextMatches(normalizedEffect, pairingContext)) {
                        continue;
                    }

                    const result = DeployTargetManager.processEffectWithTargetChoice(
                        gameEnv,
                        playerId,
                        sourceCard.carduid,
                        normalizedEffect
                    );

                    if (!result.success) {
                        return { success: false, error: result.error || 'Failed to enqueue global pairing effect' };
                    }

                    if (normalizedEffect.restrictions?.includes('once_per_turn')) {
                        EffectUsageTracker.markUsedThisTurn(sourceCard, usageKey, gameEnv.currentTurn);
                    }

                    effectsQueued += 1;
                }
            }

            return { success: true, effectsQueued };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Global pairing effect processing failed'
            };
        }
    }

    private static pairingContextMatches(effect: EffectDefinition, context: PairingGlobalContext): boolean {
        const parameters = effect.parameters as Record<string, unknown> | undefined;
        const requiredColor = typeof parameters?.['pairedUnitColor'] === 'string'
            ? (parameters!['pairedUnitColor'] as string)
            : undefined;

        if (requiredColor) {
            return (context.pairedUnitColor || '').toLowerCase() === requiredColor.toLowerCase();
        }

        return true;
    }

    private static timingAllowsTrigger(effect: EffectDefinition, gameEnv: GameEnvironment, playerId: string): boolean {
        const timing = effect.timing as Record<string, unknown> | undefined;
        const actionTurn = typeof timing?.['actionTurn'] === 'string' ? (timing!['actionTurn'] as string) : undefined;

        if (!actionTurn) {
            return true;
        }

        if (actionTurn === 'YOUR_TURN') {
            return gameEnv.currentPlayer === playerId;
        }

        return true;
    }

    private static sourceConditionsSatisfied(
        effect: EffectDefinition,
        sourceCard: ZoneCard,
        gameEnv: GameEnvironment,
        playerId: string
    ): boolean {
        if (!effect.sourceConditions || effect.sourceConditions.length === 0) {
            return true;
        }

        try {
            return ContinuousEffectManager.sourceConditionsMet(effect, sourceCard as any, gameEnv, playerId);
        } catch (error) {
            console.error('❌ Failed to evaluate source conditions for global pairing effect:', error);
            return false;
        }
    }

    private static restrictionsAllowUse(
        effect: EffectWithRestrictions,
        sourceCard: ZoneCard,
        usageKey: string,
        currentTurn: number
    ): boolean {
        const restrictions = effect.restrictions || [];
        if (restrictions.includes('once_per_turn')) {
            if (!EffectUsageTracker.canUseOncePerTurn(sourceCard, usageKey, currentTurn)) {
                return false;
            }
        }

        return true;
    }
}
