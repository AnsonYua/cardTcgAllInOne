// src/services/effects/BlockerEffectManager.ts
// Blocker effect detection system for ATTACK_REDIRECT triggered effects

import { GameEnvironment } from '../../models/GameEnvironment';
import { EffectScannerUtils, BlockerUnit } from '../../utils/EffectScannerUtils';

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
}
