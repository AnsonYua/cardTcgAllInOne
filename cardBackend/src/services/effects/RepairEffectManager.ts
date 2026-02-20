// src/services/effects/RepairEffectManager.ts
// Dedicated manager for repair/healing effects - handles both detection and execution

import { GameEnvironment } from '../../models/GameEnvironment';
import { EventType } from '../../models/GameEnums';
import { RepairEffectEvent, RepairEffectEventData, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { StateBasedAction } from '../EventQueue/StateBasedActionEngine';
import { SLOT_ZONES } from '../../config/gameConstants';
import { CardDatabaseManager } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { resolveEffectActionFromRule } from '../../utils/EffectNormalizationUtils';

// Import standardized interfaces
import {
    StandardEffectManager,
    StandardGameEvent,
    StandardExecutionResult,
    ValidationResult,
    StateChange
} from '../../interfaces/StandardizedInterfaces';
import { getCardIdFromUid } from '../../utils/CardUtils';
import { eventDataValidator } from '../../validators/EventDataValidator';
import { KeywordUtils } from '../../utils/KeywordUtils';
import { EffectNotifier } from './EffectNotifier';
import { SourceStatConditionEvaluator } from '../conditions/SourceStatConditionEvaluator';
import { SlotHealthService } from '../health/SlotHealthService';
import { SlotHealthStorage } from '../health/SlotHealthStorage';

interface ExecutionResult {
    success: boolean;
    error?: string;
}

export class RepairEffectManager implements StandardEffectManager {

    // ============ STANDARDIZED INTERFACE IMPLEMENTATION ============
    
    /**
     * Execute effect using standardized interface
     */
    async executeEffect(event: StandardGameEvent, gameEnv: GameEnvironment): Promise<StandardExecutionResult> {
        const startTime = Date.now();
        console.log(`🩹 [STANDARD] Processing Repair effect for card ${event.data.carduid}`);
        
        // Validate event data
        const validation = this.validateEffect(event, gameEnv);
        if (!validation.isValid) {
            return {
                success: false,
                effectsApplied: 0,
                affectedCards: [],
                stateChanges: [],
                error: {
                    code: 'VALIDATION_FAILED',
                    message: `Repair effect validation failed: ${validation.errors.join(', ')}`,
                    carduid: event.data.carduid,
                    playerId: event.data.playerId
                },
                warnings: validation.warnings,
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName()
                }
            };
        }
        
        const stateChanges: StateChange[] = [];
        const affectedCards: string[] = [];
        
        try {
            // Extract repair data from standardized event structure
            const repairData: RepairEffectEventData = {
                carduid: event.data.carduid,
                healAmount: event.data.parameters.value
            };
            
            console.log(`🩹 Processing repair with ${repairData.healAmount} heal amount`);
            
            const resolvedPlayerId = event.playerId ?? event.data.playerId;
            if (!resolvedPlayerId) {
                throw new Error('Repair effect event missing playerId');
            }

            const legacyEvent: RepairEffectEvent = {
                id: event.id,
                type: EventType.TRIGGER_HEALING,
                status: event.status,
                priority: event.priority,
                timestamp: event.timestamp,
                playerId: resolvedPlayerId,
                data: repairData
            };

            // Execute using existing repair logic
            const result = RepairEffectManager.executeRepairEffect(legacyEvent, gameEnv);
            
            if (result.success) {
                affectedCards.push(event.data.carduid);
                stateChanges.push({
                    type: 'CARD_PROPERTY',
                    carduid: event.data.carduid,
                    property: 'damageReceived',
                    oldValue: 'unknown', // Would need to track before value
                    newValue: 'healed',
                    timestamp: Date.now()
                });
            }
            
            return {
                success: result.success,
                effectsApplied: result.success ? 1 : 0,
                affectedCards,
                stateChanges,
                error: result.error ? {
                    code: 'EXECUTION_ERROR',
                    message: result.error,
                    carduid: event.data.carduid,
                    playerId: event.data.playerId
                } : undefined,
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName()
                }
            };
            
        } catch (error) {
            console.error(`❌ Error in standardized repair effect execution:`, error);
            return {
                success: false,
                effectsApplied: 0,
                affectedCards,
                stateChanges,
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Repair effect execution failed',
                    carduid: event.data.carduid,
                    playerId: event.data.playerId,
                    context: error
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName()
                }
            };
        }
    }
    
    /**
     * Validate effect before execution
     */
    validateEffect(event: StandardGameEvent, gameEnv: GameEnvironment): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate event structure
        const eventValidation = eventDataValidator.validateEvent(event);
        errors.push(...eventValidation.errors);
        warnings.push(...eventValidation.warnings);
        
        // Validate repair-specific requirements
        if (!event.data.parameters.value || event.data.parameters.value <= 0) {
            errors.push('Repair effect requires positive heal amount');
        }
        
        if (event.data.parameters.action !== 'heal' && event.data.parameters.action !== 'repair') {
            warnings.push(`Repair effect typically uses 'heal' or 'repair' action, found: ${event.data.parameters.action}`);
        }
        
        // Validate player exists
        if (!gameEnv.players || !gameEnv.players[event.data.playerId]) {
            errors.push(`Player ${event.data.playerId} not found in game environment`);
        }
        
        // Validate carduid format
        const cardId = getCardIdFromUid(event.data.carduid);
        if (!cardId) {
            errors.push(`Invalid carduid format: ${event.data.carduid}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Get human-readable description of effect
     */
    getEffectDescription(event: StandardGameEvent): string {
        const cardId = getCardIdFromUid(event.data.carduid);
        const healAmount = event.data.parameters.value;
        return `Repair effect for ${cardId}: heal ${healAmount} damage`;
    }
    
    /**
     * Get manager name for identification
     */
    getManagerName(): string {
        return 'RepairEffectManager';
    }
    
    // ============ EXISTING LEGACY METHODS ============

    /**
     * DETECTION: Check for repair abilities at end of turn
     */
    static checkRepairAbilities(gameEnv: GameEnvironment, playerId: string): StateBasedAction[] {
        const actions: StateBasedAction[] = [];

        const player = gameEnv.players[playerId];
        if (!player || !player.zones) {
            return actions;
        }
        
        // Check all slot zones for units with repair abilities
        for (const slot of SLOT_ZONES) {
            const slotZone = (player.zones as any)[slot];
            
            if (slotZone?.unit) {
                const unit = slotZone.unit;
                const currentDamage = SlotHealthStorage.getSharedDamage(slotZone);
                if (currentDamage <= 0) {
                    continue;
                }
                
                // Extract cardId from carduid using established pattern
                const cardId = getCardIdFromUid(unit.carduid);
                
                const cardData = CardDatabaseManager.getCardDetails(cardId);
                
                if (cardData?.effects?.rules) {
                    // Look for repair abilities
                    cardData.effects.rules.forEach((effect: any, index: number) => {
                        const resolvedAction = resolveEffectActionFromRule(effect);
                        
                        if (effect.trigger === 'END_OF_TURN' && resolvedAction === 'heal') {
                            if (!RepairEffectManager.areEndOfTurnHealConditionsMet(gameEnv, unit.carduid, effect)) {
                                return;
                            }
                            
                            const healAmount = effect.parameters?.value ??  0;
                            if (typeof healAmount !== 'number' || healAmount <= 0) {
                                return;
                            }

                            const effectLabel = typeof effect.effectId === 'string' && effect.effectId.length > 0
                                ? effect.effectId
                                : `rule_${index}`;
                            actions.push(
                                RepairEffectManager.createRepairAction(
                                    `repair_${effectLabel}_${unit.carduid}`,
                                    unit.carduid,
                                    healAmount
                                )
                            );

                            console.log(`🩹 Queued end-of-turn heal ${healAmount} for ${unit.carduid} (${effectLabel})`);
                        }
                    });
                }

                const repairValue = KeywordUtils.getKeywordValue(unit, 'Repair');
                if (typeof repairValue === 'number' && repairValue > 0) {
                    actions.push(
                        RepairEffectManager.createRepairAction(
                            `repair_keyword_${unit.carduid}`,
                            unit.carduid,
                            repairValue
                        )
                    );
                    console.log(`🩹 Queued Repair ${repairValue} keyword heal for ${unit.carduid}`);
                }
            }
        }
        return actions;
    }

    private static createRepairAction(actionIdPrefix: string, carduid: string, healAmount: number): StateBasedAction {
        const repairActionData: RepairEffectEventData = {
            carduid,
            healAmount
        };

        return {
            actionId: `${actionIdPrefix}_${Date.now()}`,
            type: EventType.TRIGGER_HEALING,
            autoExecute: true,
            data: repairActionData
        };
    }

    private static areEndOfTurnHealConditionsMet(
        gameEnv: GameEnvironment,
        sourceUnitCarduid: string,
        effectRule: any
    ): boolean {
        const conditions = Array.isArray(effectRule?.conditions) ? effectRule.conditions : [];
        if (conditions.length === 0) {
            return true;
        }

        for (const condition of conditions) {
            if (!condition || typeof condition !== 'object') {
                continue;
            }

            const type = typeof (condition as any).type === 'string' ? ((condition as any).type as string) : '';
            const value = (condition as any).value;

            if (type === 'sourceHP') {
                if (!SourceStatConditionEvaluator.sourceHpMatches(gameEnv, sourceUnitCarduid, value)) {
                    return false;
                }
                continue;
            }

            if (type === 'sourceAp' || type === 'sourceAP') {
                if (!SourceStatConditionEvaluator.sourceApMatches(gameEnv, sourceUnitCarduid, value)) {
                    return false;
                }
                continue;
            }

            console.warn(`⚠️ Unsupported END_OF_TURN heal condition type: ${type}`);
            return false;
        }

        return true;
    }

    /**
     * EXECUTION: Execute repair effect on specific card
     */
    static executeRepairEffect(event: RepairEffectEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🩹 Executing repair effect: ${event.id}`);
        
        try {
            const data = event.data;
            
            if (!data.carduid || !data.healAmount) {
                return {
                    success: false,
                    error: 'Invalid repair data - missing carduid or healAmount'
                };
            }

            // Find the card to heal using SlotZoneUtils
            let cardLocation: { card: any; playerId: string; slot: string } | null = null;
            
            // Search across all players using SlotZoneUtils
            for (const playerId of Object.keys(gameEnv.players)) {
                const player = gameEnv.players[playerId];
                if (!player?.zones) continue;
                
                const slotResult = SlotZoneUtils.findSlotByCarduid(player.zones, data.carduid);
                if (slotResult.slotName) {
                    // Found the card - determine if it's unit or pilot
                    const card = slotResult.unit?.carduid === data.carduid ? slotResult.unit : slotResult.pilot;
                    if (card) {
                        cardLocation = { card, playerId, slot: slotResult.slotName };
                        break;
                    }
                }
            }
            
            if (!cardLocation) {
                return {
                    success: false,
                    error: `Card ${data.carduid} not found for repair`
                };
            }

            const change = SlotHealthService.applyHealByCarduid(gameEnv, data.carduid, data.healAmount);
            if (!change) {
                return {
                    success: false,
                    error: `Card ${data.carduid} has no slot health information`
                };
            }

            const healedAmount = Math.max(0, change.previousDamage - change.sharedDamage);
            if (healedAmount <= 0) {
                return { success: true };
            }
            console.log(`✅ Repaired ${data.carduid}: healed ${healedAmount} damage (remaining: ${change.sharedDamage})`);

            const target: TargetReference = {
                playerId: cardLocation.playerId,
                carduid: data.carduid,
                zone: cardLocation.slot,
                cardData: cardLocation.card.cardData
            };

            EffectNotifier.notifyCardHealed(
                gameEnv,
                cardLocation.card,
                target,
                healedAmount,
                change.sharedDamage,
                change.remainingHp,
                change.maxHp,
                'repair'
            );

            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error executing repair effect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Repair execution failed'
            };
        }
    }

    // ============ HELPER METHODS ============


}
