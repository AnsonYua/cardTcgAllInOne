// src/services/effects/RepairEffectManager.ts
// Dedicated manager for repair/healing effects - handles both detection and execution

import { GameEnvironment } from '../../models/GameEnvironment';
import { EventType } from '../../models/GameEnums';
import { GameEvent, EventStatus, EventPriority } from '../EventQueue/interfaces/GameEvent';
import { StateBasedAction } from '../EventQueue/StateBasedActionEngine';
import { SLOT_ZONES } from '../../config/gameConstants';
import { CardDatabaseManager } from '../../models/CardSystem';

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

// Minimal data structure for repair effects
interface RepairEventData {
    carduid: string;
    healAmount: number;
}

interface ExecutionResult {
    success: boolean;
    error?: string;
}

export class RepairEffectManager implements StandardEffectManager {
    private static processedRepairActions: Set<string> = new Set();

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
            const repairData: RepairEventData = {
                carduid: event.data.carduid,
                healAmount: event.data.parameters.value
            };
            
            console.log(`🩹 Processing repair with ${repairData.healAmount} heal amount`);
            
            // Execute using existing repair logic
            const result = RepairEffectManager.executeRepairEffect(event as any, gameEnv);
            
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
                // Extract cardId from carduid using established pattern
                const cardId = getCardIdFromUid(unit.carduid);
                const cardData = CardDatabaseManager.getCardDetails(cardId);
                
                if (cardData?.effects?.rules) {
                    // Look for repair abilities
                    cardData.effects.rules.forEach((effect: any) => {
                        if (effect.trigger === 'END_OF_TURN' && effect.action === 'heal') {
                            // Create unique key for this repair action per turn
                            const repairKey = `${unit.carduid}_${effect.effectId}_turn_${gameEnv.currentTurn}`;
                            
                            // Only add if not processed this turn
                            if (!this.processedRepairActions.has(repairKey)) {
                                console.log(`🩹 Found repair ability: ${effect.effectId} on ${cardId}`);
                                
                                // Mark as processed
                                this.processedRepairActions.add(repairKey);
                                
                                actions.push({
                                    actionId: `repair_${unit.carduid}_${Date.now()}`,
                                    type: EventType.TRIGGER_HEALING,
                                    autoExecute: true,
                                    data: {
                                        carduid: unit.carduid,
                                        healAmount: effect.parameters.value
                                    } as RepairEventData
                                });
                            }
                        }
                    });
                }
            }
        }
        
        // Clean up old repair actions from previous turns
        this.cleanupOldRepairActions(gameEnv.currentTurn);
        
        return actions;
    }

    /**
     * EXECUTION: Execute repair effect on specific card
     */
    static executeRepairEffect(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🩹 Executing repair effect: ${event.id}`);
        
        try {
            const data = event.data as RepairEventData;
            
            if (!data.carduid || !data.healAmount) {
                return {
                    success: false,
                    error: 'Invalid repair data - missing carduid or healAmount'
                };
            }

            // Find the card to heal
            const cardLocation = this.findCardByUid(gameEnv, data.carduid);
            if (!cardLocation) {
                return {
                    success: false,
                    error: `Card ${data.carduid} not found for repair`
                };
            }

            // Apply healing
            const currentDamage = cardLocation.card.damageReceived || 0;
            const healedAmount = Math.min(data.healAmount, currentDamage);
            cardLocation.card.damageReceived = currentDamage - healedAmount;
            
            console.log(`✅ Repaired ${data.carduid}: healed ${healedAmount} damage (remaining: ${cardLocation.card.damageReceived})`);
            
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

    /**
     * Find card by UID across all players and slots
     */
    private static findCardByUid(gameEnv: GameEnvironment, carduid: string): { card: any; playerId: string; slot: string } | null {
        for (const playerId of Object.keys(gameEnv.players)) {
            const player = gameEnv.players[playerId];
            if (!player?.zones) continue;
            
            for (const slot of SLOT_ZONES) {
                const slotZone = (player.zones as any)[slot];
                if (slotZone?.unit?.carduid === carduid) {
                    return { card: slotZone.unit, playerId, slot };
                }
                if (slotZone?.pilot?.carduid === carduid) {
                    return { card: slotZone.pilot, playerId, slot };
                }
            }
        }
        return null;
    }

    /**
     * Clean up old repair action tracking
     */
    private static cleanupOldRepairActions(currentTurn: number): void {
        const keysToRemove: string[] = [];
        Array.from(this.processedRepairActions).forEach(key => {
            if (!key.includes(`_turn_${currentTurn}`)) {
                keysToRemove.push(key);
            }
        });
        keysToRemove.forEach(key => this.processedRepairActions.delete(key));
    }
}