// src/services/effects/BlockerEffectManager.ts
// Blocker effect detection system for ATTACK_REDIRECT triggered effects

import { GameEnvironment } from '../../models/GameEnvironment';
import { EffectScannerUtils, BlockerUnit } from '../../utils/EffectScannerUtils';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { ConditionEvaluators } from '../conditions/ConditionEvaluators';
import { evaluateCardsInPlayCondition } from '../conditions/CardsInPlayCondition';

/**
 * BlockerEffectManager handles blocker unit detection
 * Uses centralized EffectScannerUtils for effect detection
 * Choice logic moved to BlockerChoiceManager following DeployTargetManager pattern
 */
export class BlockerEffectManager {

    /**
     * Check for available blocker units in defending player's zones
     * Delegates to centralized EffectScannerUtils
     */
    static checkForBlockerUnits(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        options?: { excludeCarduid?: string }
    ): BlockerUnit[] {
        console.log(`🛡️ Checking for blocker units for player ${defendingPlayerId}`);
        
        let blockers = EffectScannerUtils.scanForBlockerUnits(gameEnv, defendingPlayerId);
        blockers = blockers.filter(blocker => this.conditionsSatisfied(gameEnv, defendingPlayerId, blocker.effect?.conditions));

        if (options?.excludeCarduid) {
            const before = blockers.length;
            blockers = blockers.filter(blocker => blocker.carduid !== options.excludeCarduid);
            const removed = before - blockers.length;
            if (removed > 0) {
                console.log(
                    `🛡️ Excluded ${removed} blocker(s) matching current target ${options.excludeCarduid}`
                );
            }
        }
        
        console.log(`🛡️ Found ${blockers.length} available blocker units`);
        return blockers;
    }

    /**
     * Get available blocker targets in TargetReference format
     * Centralizes scanning + conversion to keep blocker availability logic in one place
     */
    static getAvailableBlockerTargets(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        options?: { excludeCarduid?: string }
    ): TargetReference[] {
        const blockers = this.checkForBlockerUnits(gameEnv, defendingPlayerId, options);
        return this.convertBlockersToTargetReferences(gameEnv, blockers, defendingPlayerId);
    }

    /**
     * Convert BlockerUnit[] to TargetReference[] format (similar to DeployTargetManager.generateAvailableTargets)
     * Uses findSlotByCarduid to derive zone and player information from carduid
     */
    private static convertBlockersToTargetReferences(
        gameEnv: GameEnvironment,
        availableBlockers: BlockerUnit[],
        defendingPlayerId: string
    ): TargetReference[] {
        const targets: TargetReference[] = [];
        
        console.log(`🔄 Converting ${availableBlockers.length} blockers to TargetReference format`);
        
        for (const blocker of availableBlockers) {
            const player = gameEnv.getPlayer(defendingPlayerId);
            if (!player) {
                console.error(`❌ Player ${defendingPlayerId} not found for blocker ${blocker.carduid}`);
                continue;
            }
            
            const slotResult = SlotZoneUtils.findSlotByCarduid(player.zones, blocker.carduid);
            if (slotResult.slotName && slotResult.unit) {
                if (slotResult.unit.isRested) {
                    continue;
                }
                targets.push({
                    carduid: blocker.carduid,
                    zone: slotResult.slotName,
                    playerId: defendingPlayerId,
                    cardData: slotResult.unit.cardData
                });
                console.log(`✅ Converted blocker ${blocker.carduid} in ${slotResult.slotName} to TargetReference`);
            } else {
                console.log(`⚠️ Could not find slot for blocker ${blocker.carduid}`);
            }
        }
        
        console.log(`🔄 Converted ${targets.length} of ${availableBlockers.length} blockers to TargetReference format`);
        return targets;
    }


    /**
     * Check if any blocker units are available for the defending player
     * Quick check without creating events
     */
    static hasAvailableBlockers(gameEnv: GameEnvironment, defendingPlayerId: string): boolean {
        const blockers = this.checkForBlockerUnits(gameEnv, defendingPlayerId);
        return blockers.length > 0;
    }

    /**
     * Get blocker effect description for UI display
     */
    static getBlockerDescription(blocker: BlockerUnit): string {
        const cost = blocker.effect.parameters?.cost || 'rest_self';
        return `Blocker (${cost}): Rest this unit to redirect attack to it`;
    }

    private static conditionsSatisfied(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        conditions: unknown
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return true;
        }

        return conditions.every((condition: any) => {
            if (!condition || typeof condition !== 'object') {
                return true;
            }

            const type = typeof condition.type === 'string' ? condition.type : '';
            switch (type) {
                case 'cardsInPlay':
                    return evaluateCardsInPlayCondition(gameEnv, defendingPlayerId, condition);
                case 'unitsInPlayWithFilter':
                    return ConditionEvaluators.evaluateUnitsInPlayWithFilterCondition(gameEnv, defendingPlayerId, condition);
                case 'unitsInPlayWithTrait':
                    return ConditionEvaluators.unitsInPlayWithTrait(
                        gameEnv,
                        defendingPlayerId,
                        Array.isArray(condition.traits) ? condition.traits : [],
                        condition.value
                    );
                case 'cardsInTrash':
                case 'cardsInTrashWithTraitsAny':
                    return ConditionEvaluators.cardsInTrashWithTraitsAny(
                        gameEnv,
                        defendingPlayerId,
                        Array.isArray(condition.traitsAny) ? condition.traitsAny : [],
                        condition.value
                    );
                default:
                    console.log(`⚠️ Blocker condition type not supported: ${type}`);
                    return true;
            }
        });
    }
}
