// src/services/BlockerChoiceManager.ts
// Blocker choice processing system following TargetChoiceManager pattern

import { GameEnvironment } from '../models/GameEnvironment';
import { 
    BlockerChoiceEvent, 
    PlayerActionEvent,
    EventFactory 
} from './EventQueue/interfaces/GameEvent';
import { BlockerEffectManager } from './effects/BlockerEffectManager';
import { BlockerUnit } from '../utils/EffectScannerUtils';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';

export interface BlockerChoiceResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;    // true if BLOCKER_CHOICE event created
    autoBlocked?: boolean;         // true if auto-blocked 
    normalAttack?: boolean;        // true if no blockers, proceed normally
    affectedBlocker?: BlockerUnit; // for auto-blocked scenario
}

export interface ExecutionResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;
}

/**
 * BlockerChoiceManager handles blocker selection logic following TargetChoiceManager pattern
 * Provides unified choice logic for blocker opportunities during attacks
 */
export class BlockerChoiceManager {

    /**
     * Main entry point: Process attack that may require blocker selection
     * 
     * Logic (similar to TargetChoiceManager.processEffectWithTargetChoice):
     * - If multiple blockers available → Create BLOCKER_CHOICE event
     * - If no blockers available → Proceed with normal attack
     * - Future: Could support auto-blocking with single blocker
     */
    static processAttackWithBlockerChoice(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        defendingPlayerId: string
    ): BlockerChoiceResult {
        console.log(`🛡️ Processing attack with blocker choice for player ${defendingPlayerId}`);

        try {
            // Step 1: Check for available blockers (delegate to BlockerEffectManager)
            const availableBlockers = BlockerEffectManager.checkForBlockerUnits(gameEnv, defendingPlayerId);
            console.log(`🛡️ Found ${availableBlockers.length} blockers for defending player ${defendingPlayerId}`);
            
            if (availableBlockers.length === 0) {
                console.log(`🛡️ No blockers available, proceeding with normal attack`);
                return { 
                    success: true, 
                    normalAttack: true 
                };
            }

            // Step 2: Apply choice logic (similar to TargetChoiceManager.requiresPlayerChoice)
            if (this.requiresPlayerChoice(availableBlockers)) {
                // Create BLOCKER_CHOICE event for player selection
                const blockerChoiceEvent = EventFactory.createBlockerChoiceEvent({
                    blockingPlayerId: defendingPlayerId,
                    originalAttackEvent: attackEvent,
                    availableBlockers
                });
                
                // Add to processing queue for game event processing
                gameEnv.processingQueue.push(blockerChoiceEvent);
                
                console.log(`🛡️ Created BLOCKER_CHOICE event ${blockerChoiceEvent.id} with ${availableBlockers.length} blockers`);
                return { 
                    success: true, 
                    requiresSelection: true 
                };
                
            } else {
                // Future: Could implement auto-blocking logic here
                // For now, always offer choice when blockers are available
                console.log(`🛡️ No auto-blocking logic, proceeding with normal attack`);
                return { 
                    success: true, 
                    normalAttack: true 
                };
            }
            
        } catch (error) {
            console.error(`❌ Error in processAttackWithBlockerChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Blocker choice processing failed'
            };
        }
    }

    /**
     * Execute BLOCKER_CHOICE event when player makes selection
     * Moved from BlockerEffectManager.executeBlockerChoice
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
     * Determine if player choice is required for blockers
     * Similar to TargetChoiceManager.requiresPlayerChoice logic
     */
    private static requiresPlayerChoice(availableBlockers: BlockerUnit[]): boolean {
        // For now, always offer choice when blockers are available
        // Future: Could implement auto-blocking for single blocker scenarios
        return availableBlockers.length > 0;
    }

    /**
     * Apply blocker cost - rest the blocker unit immediately
     * Moved from BlockerEffectManager
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
     * Moved from BlockerEffectManager
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
     * Moved from BlockerEffectManager
     */
    private static executeNormalAttack(eventData: any, gameEnv: GameEnvironment): ExecutionResult {
        // Import GameEngine dynamically to avoid circular dependency
        const { GameEngine } = require('./GameEngine');
        
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
}