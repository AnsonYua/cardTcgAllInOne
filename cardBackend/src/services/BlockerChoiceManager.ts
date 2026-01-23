// src/services/BlockerChoiceManager.ts
// Blocker choice processing system following DeployTargetManager pattern

import { GameEnvironment } from '../models/GameEnvironment';
import {
    BlockerChoiceEvent,
    PlayerActionEvent,
    TargetReference
} from './EventQueue/interfaces/GameEvent';
import { EventFactory } from './EventQueue/EventFactory';
import { BlockerEffectManager } from './effects/BlockerEffectManager';
import { BattlePhaseManager } from './BattlePhaseManager';
import { ExecutionResult } from './ExecutionResult';
import { ChoiceNotificationEmitter } from './notifications/ChoiceNotificationEmitter';
import { applyRestEffect } from './effects/actions/EffectRestActions';
import { TargetCardResolver } from './targets/TargetCardResolver';
import { BattleNotificationEmitter } from './notifications/BattleNotificationEmitter';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { KeywordUtils } from '../utils/KeywordUtils';

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
            const attackerCarduid = this.getAttackerCarduid(attackEvent);
            if (attackerCarduid) {
                const attackerCard = SlotZoneUtils.getCardByUid(gameEnv, attackerCarduid);
                if (attackerCard && KeywordUtils.isUnblockable(attackerCard as any)) {
                    console.log(`🛡️ Skipping blocker step: attacker ${attackerCarduid} has High-Maneuver`);
                    return { success: true, normalAttack: true };
                }
            }

            // Step 1: Check for available blockers (delegate to BlockerEffectManager)
            const currentTargetCarduid = this.getCurrentAttackTargetCarduid(attackEvent);
            const blockerTargets = BlockerEffectManager.getAvailableBlockerTargets(gameEnv, defendingPlayerId, {
                excludeCarduid: currentTargetCarduid
            });
            console.log(`🛡️ Found ${blockerTargets.length} blockers for defending player ${defendingPlayerId}`);

            if (blockerTargets.length === 0) {
                console.log(`🛡️ No blockers available, proceeding with normal attack`);
                return { 
                    success: true, 
                    normalAttack: true 
                };
            }

            // Step 2: Apply choice logic (similar to DeployTargetManager.requiresPlayerChoice)
            if (this.requiresPlayerChoice(blockerTargets)) {
                // Create BLOCKER_CHOICE event for player selection with converted format
                const blockerChoiceEvent = EventFactory.createBlockerChoiceEvent({
                    blockingPlayerId: defendingPlayerId,
                    originalAttackEvent: attackEvent,
                    availableTargets: blockerTargets
                });
                
                // Add to processing queue for game event processing
                gameEnv.enqueueForProcessing(blockerChoiceEvent);
                gameEnv.enterBlockerPhase();
                ChoiceNotificationEmitter.emitBlockerChoiceCreated(gameEnv, blockerChoiceEvent);
                
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
                ChoiceNotificationEmitter.emitBlockerChoiceResolved(gameEnv, event, 'BLOCK');

                // Step 1: Pay blocker cost immediately (rest the blocker)
                const costPaid = this.applyBlockerCost(eventData.selectedTarget, gameEnv);
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

                BattleNotificationEmitter.emitAttackRedirected(gameEnv, {
                    blockingPlayerId: eventData.blockingPlayerId,
                    attackerPlayerId: redirectedEvent.playerId,
                    attackerCarduid: this.getAttackerCarduid(redirectedEvent),
                    fromTargetCarduid: this.getCurrentAttackTargetCarduid(eventData.originalAttackEvent),
                    toTargetCarduid: eventData.selectedTarget.carduid,
                    blockerCarduid: eventData.selectedTarget.carduid,
                    timestamp: Date.now()
                });

                // Step 3: Execute redirected attack through normal pipeline
                return BattlePhaseManager.startBattle(gameEnv, redirectedEvent);
            }

            // Player declined blocking - attack proceeds normally
            console.log(`🛡️ Blocking declined, attack proceeds to original target`);
            ChoiceNotificationEmitter.emitBlockerChoiceResolved(gameEnv, event, 'DECLINE');
            return BattlePhaseManager.startBattle(gameEnv, eventData.originalAttackEvent);
            
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
     * Similar to DeployTargetManager.requiresPlayerChoice logic
     */
    private static requiresPlayerChoice(availableTargets: TargetReference[]): boolean {
        // For now, always offer choice when blockers are available
        // Future: Could implement auto-blocking for single blocker scenarios
        return availableTargets.length > 0;
    }

    /**
     * Apply blocker cost - rest the blocker unit immediately
     * Moved from BlockerEffectManager
     */
    private static applyBlockerCost(blockerTarget: TargetReference, gameEnv: GameEnvironment): boolean {
        console.log(`💤 Applying blocker cost: resting ${blockerTarget.carduid}`);

        const resolved = TargetCardResolver.resolve(gameEnv, blockerTarget);
        if (!resolved || (resolved.kind !== 'unit' && resolved.kind !== 'pilot')) {
            console.log(`❌ Blocker ${blockerTarget.carduid} not found for cost payment`);
            return false;
        }

        if (resolved.card.isRested) {
            console.log(`⚠️ Blocker ${blockerTarget.carduid} is already rested`);
            return false;
        }

        const restResult = applyRestEffect(
            gameEnv,
            blockerTarget.playerId,
            blockerTarget.carduid,
            null,
            [blockerTarget]
        );

        if (!restResult.success) {
            console.log(`❌ Failed to rest blocker ${blockerTarget.carduid}: ${restResult.error ?? 'unknown error'}`);
            return false;
        }

        console.log(`✅ Blocker ${blockerTarget.carduid} has been rested as cost`);
        return true;
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

    private static getAttackerCarduid(attackEvent: PlayerActionEvent): string | undefined {
        const attacker = (attackEvent as any)?.data?.attackerCarduid;
        return typeof attacker === 'string' ? attacker : undefined;
    }

}
