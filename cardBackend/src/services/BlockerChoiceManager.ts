// src/services/BlockerChoiceManager.ts
// Blocker choice processing system following DeployTargetManager pattern

import { GameEnvironment } from '../models/GameEnvironment';
import {
    BlockerChoiceEvent,
    PlayerActionEvent,
    EventFactory,
    TargetReference
} from './EventQueue/interfaces/GameEvent';
import { BlockerEffectManager } from './effects/BlockerEffectManager';
import { BlockerUnit } from '../utils/EffectScannerUtils';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { BattlePhaseManager } from './BattlePhaseManager';
import { ExecutionResult } from './ExecutionResult';

export interface BlockerChoiceResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;    // true if BLOCKER_CHOICE event created
    autoBlocked?: boolean;         // true if auto-blocked 
    normalAttack?: boolean;        // true if no blockers, proceed normally
    affectedTarget?: TargetReference; // for auto-blocked scenario
}

/**
 * BlockerChoiceManager handles blocker selection logic following DeployTargetManager pattern
 * Provides unified choice logic for blocker opportunities during attacks
 */
export class BlockerChoiceManager {

    /**
     * Main entry point: Process attack that may require blocker selection
     * 
     * Logic (similar to DeployTargetManager.processEffectWithTargetChoice):
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
            const currentTargetCarduid = this.getCurrentAttackTargetCarduid(attackEvent);
            const availableBlockers = BlockerEffectManager.checkForBlockerUnits(gameEnv, defendingPlayerId, {
                excludeCarduid: currentTargetCarduid
            });
            console.log(`🛡️ Found ${availableBlockers.length} blockers for defending player ${defendingPlayerId}`);

            if (availableBlockers.length === 0) {
                console.log(`🛡️ No blockers available, proceeding with normal attack`);
                return { 
                    success: true, 
                    normalAttack: true 
                };
            }

            // Step 2: Convert blockers to TargetReference format (similar to DeployTargetManager.generateAvailableTargets)
            // This provides consistent structure with zone, playerId, and cardData for each blocker
            const blockerTargets = this.convertBlockersToTargetReferences(gameEnv, availableBlockers, defendingPlayerId);
            
            // Step 3: Apply choice logic (similar to DeployTargetManager.requiresPlayerChoice)
            if (this.requiresPlayerChoice(availableBlockers)) {
                // Create BLOCKER_CHOICE event for player selection with converted format
                const blockerChoiceEvent = EventFactory.createBlockerChoiceEvent({
                    blockingPlayerId: defendingPlayerId,
                    originalAttackEvent: attackEvent,
                    availableTargets: blockerTargets
                });
                
                // Add to processing queue for game event processing
                gameEnv.processingQueue.push(blockerChoiceEvent);
                gameEnv.enterBlockerPhase();
                
                console.log(`🛡️ Created BLOCKER_CHOICE event ${blockerChoiceEvent.id} with ${blockerTargets.length} blocker targets`);
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

                if (eventData.selectedTarget) {
                    // Player chose a blocker - redirect attack
                    console.log(`🛡️ Blocker chosen: ${eventData.selectedTarget.carduid}`);
                
                // Step 1: Pay blocker cost immediately (rest the blocker)
                const costPaid = this.applyBlockerCost(eventData.selectedTarget.carduid, gameEnv);
                if (!costPaid) {
                    return { 
                        success: false, 
                        error: 'Failed to rest blocker unit - unit may already be rested or not found'
                    };
                }
                
                // Step 2: Redirect attack target to blocker
                const redirectedEvent = this.createRedirectedAttackEvent(
                    eventData.originalAttackEvent, 
                    eventData.selectedTarget
                );
                
                // Step 3: Execute redirected attack through normal pipeline
                return BattlePhaseManager.startBattle(gameEnv, redirectedEvent);
                
            } else {
                // Player declined blocking - attack proceeds normally
                console.log(`🛡️ Blocking declined, attack proceeds to original target`);
                return BattlePhaseManager.startBattle(gameEnv, eventData.originalAttackEvent);
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
            // Use findSlotByCarduid to get zone and card data
            const player = gameEnv.getPlayer(defendingPlayerId);
            if (!player) {
                console.error(`❌ Player ${defendingPlayerId} not found for blocker ${blocker.carduid}`);
                continue;
            }
            
            const slotResult = SlotZoneUtils.findSlotByCarduid(player.zones, blocker.carduid);
            if (slotResult.slotName && slotResult.unit) {
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
     * Determine if player choice is required for blockers
     * Similar to DeployTargetManager.requiresPlayerChoice logic
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
        blockerTarget: TargetReference
    ): PlayerActionEvent {
        console.log(`🎯 Redirecting attack from original target to blocker ${blockerTarget.carduid}`);

        const originalData = originalEvent.data || {};
        const redirectedData: any = {
            ...originalData,
            targetCarduid: blockerTarget.carduid
        };
        redirectedData.forcedTarget = {
            carduid: blockerTarget.carduid,
            zone: blockerTarget.zone,
            playerId: blockerTarget.playerId
        };

        if (originalData.actionType === 'attackShieldArea') {
            redirectedData.actionType = 'attackUnit';
            redirectedData.targetUnitUid = blockerTarget.carduid;
            redirectedData.targetPlayerId = blockerTarget.playerId;
            delete redirectedData.targetSlotName;
        } else if (originalData.actionType === 'attackUnit') {
            redirectedData.targetUnitUid = blockerTarget.carduid;
            redirectedData.targetPlayerId = blockerTarget.playerId;
        }

        return {
            ...originalEvent,
            data: redirectedData
        };
    }

    private static getCurrentAttackTargetCarduid(attackEvent: PlayerActionEvent): string | undefined {
        if (!attackEvent?.data) {
            return undefined;
        }

        const eventData = attackEvent.data;

        if (typeof eventData.targetCarduid === 'string') {
            return eventData.targetCarduid;
        }

        if (typeof eventData.targetUnitUid === 'string') {
            return eventData.targetUnitUid;
        }

        if (typeof eventData.targetUnitId === 'string') {
            return eventData.targetUnitId;
        }

        return undefined;
    }

}
