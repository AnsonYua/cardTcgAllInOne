// src/services/effects/BlockerEffectManager.ts
// Blocker effect processing system for ATTACK_REDIRECT triggered effects

import { GameEnvironment } from '../../models/GameEnvironment';
import { 
    BlockerChoiceEvent, 
    PlayerActionEvent,
    EventFactory 
} from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { EffectScannerUtils, BlockerUnit } from '../../utils/EffectScannerUtils';

export interface ExecutionResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;
}

/**
 * BlockerEffectManager handles blocker unit detection and attack redirection
 * Uses centralized EffectScannerUtils for effect detection
 * Follows TargetChoiceManager pattern for player choice events
 */
export class BlockerEffectManager {

    /**
     * Check for available blocker units in defending player's zones
     * Delegates to centralized EffectScannerUtils
     */
    static checkForBlockerUnits(gameEnv: GameEnvironment, defendingPlayerId: string): BlockerUnit[] {
        console.log(`🛡️ Checking for blocker units for player ${defendingPlayerId}`);
        
        const blockers = EffectScannerUtils.scanForBlockerUnits(gameEnv, defendingPlayerId);
        
        console.log(`🛡️ Found ${blockers.length} available blocker units`);
        return blockers;
    }

    /**
     * Create blocker choice event for defending player
     * Follows EventFactory pattern
     */
    static createBlockerChoiceEvent(
        gameEnv: GameEnvironment, 
        availableBlockers: BlockerUnit[], 
        originalAttackEvent: PlayerActionEvent
    ): void {
        const defendingPlayerId = gameEnv.getOpponentId(originalAttackEvent.playerId);
        if (!defendingPlayerId) {
            console.error(`❌ No opponent found for attacking player ${originalAttackEvent.playerId}`);
            return;
        }

        const blockerChoiceEvent = EventFactory.createBlockerChoiceEvent({
            blockingPlayerId: defendingPlayerId,
            originalAttackEvent,
            availableBlockers
        });

        gameEnv.processingQueue.push(blockerChoiceEvent);
        console.log(`🛡️ Created BLOCKER_CHOICE event ${blockerChoiceEvent.id} with ${availableBlockers.length} available blockers`);
    }

    /**
     * Execute blocker choice when defending player makes selection
     * Handles both blocker selection and decline scenarios
     */
    static executeBlockerChoice(event: BlockerChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🛡️ Executing blocker choice event: ${event.id}`);
        
        try {
            const eventData = event.data;
            
            if (!eventData.userDecisionMade) {
                return {
                    success: false,
                    error: 'Blocker choice not yet made by player'
                };
            }

            if (eventData.selectedBlocker) {
                // Player chose a blocker - redirect attack
                console.log(`🛡️ Blocker chosen: ${eventData.selectedBlocker.carduid}`);
                
                // Step 1: Pay blocker cost immediately (rest the blocker)
                const costPaid = this.applyBlockerCost(eventData.selectedBlocker.carduid, gameEnv);
                if (!costPaid) {
                    return { 
                        success: false, 
                        error: 'Failed to rest blocker unit - unit may already be rested or not found'
                    };
                }
                
                // Step 2: Redirect attack target to blocker
                const redirectedEvent = this.createRedirectedAttackEvent(
                    eventData.originalAttackEvent, 
                    eventData.selectedBlocker.carduid
                );
                
                // Step 3: Execute redirected attack through normal pipeline
                return this.executeNormalAttack(redirectedEvent.data, gameEnv);
                
            } else {
                // Player declined blocking - attack proceeds normally
                console.log(`🛡️ Blocking declined, attack proceeds to original target`);
                return this.executeNormalAttack(eventData.originalAttackEvent.data, gameEnv);
            }
            
        } catch (error) {
            console.error(`❌ Error in executeBlockerChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Blocker choice execution failed'
            };
        }
    }

    /**
     * Apply blocker cost - rest the blocker unit immediately
     */
    private static applyBlockerCost(blockerCarduid: string, gameEnv: GameEnvironment): boolean {
        console.log(`💤 Applying blocker cost: resting ${blockerCarduid}`);
        
        // Find the blocker unit across all players
        for (const playerId of Object.keys(gameEnv.players)) {
            const player = gameEnv.getPlayer(playerId);
            if (!player || !player.zones) continue;
            
            const slotResult = SlotZoneUtils.findSlotByCarduid(player.zones, blockerCarduid);
            if (slotResult.slotName) {
                const unit = slotResult.unit;
                if (unit && unit.carduid === blockerCarduid) {
                    if (unit.isRested) {
                        console.log(`⚠️ Blocker ${blockerCarduid} is already rested`);
                        return false;
                    }
                    
                    unit.isRested = true;
                    console.log(`✅ Blocker ${blockerCarduid} has been rested as cost`);
                    return true;
                }
            }
        }
        
        console.log(`❌ Blocker ${blockerCarduid} not found for cost payment`);
        return false;
    }

    /**
     * Create redirected attack event with new target
     * Maintains same actionType but changes targetCarduid
     */
    private static createRedirectedAttackEvent(
        originalEvent: PlayerActionEvent, 
        blockerCarduid: string
    ): PlayerActionEvent {
        console.log(`🎯 Redirecting attack from original target to blocker ${blockerCarduid}`);
        
        return {
            ...originalEvent,
            data: {
                ...originalEvent.data,
                targetCarduid: blockerCarduid  // KEY CHANGE: Redirect to blocker
            }
        };
    }

    /**
     * Execute normal attack through existing pipeline
     * Delegates to GameEngine attack handlers
     */
    private static executeNormalAttack(eventData: any, gameEnv: GameEnvironment): ExecutionResult {
        // Import GameEngine dynamically to avoid circular dependency
        const { GameEngine } = require('../GameEngine');
        
        switch (eventData.actionType) {
            case 'attackUnit':
                return GameEngine.handleAttackUnit(eventData, gameEnv);
                
            case 'attackShieldArea':
                return GameEngine.handleAttackShieldArea(eventData, gameEnv);
                
            default:
                return {
                    success: false,
                    error: `Unknown actionType: ${eventData.actionType}`
                };
        }
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