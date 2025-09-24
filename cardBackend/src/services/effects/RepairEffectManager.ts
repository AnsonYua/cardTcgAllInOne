// src/services/effects/RepairEffectManager.ts
// Dedicated manager for repair/healing effects - handles both detection and execution

import { GameEnvironment } from '../../models/GameEnvironment';
import { EventType } from '../../models/GameEnums';
import { GameEvent, EventStatus, EventPriority } from '../EventQueue/interfaces/GameEvent';
import { StateBasedAction } from '../EventQueue/StateBasedActionEngine';
import { SLOT_ZONES } from '../../config/gameConstants';
import { CardDatabaseManager } from '../../models/CardSystem';

// Minimal data structure for repair effects
interface RepairEventData {
    carduid: string;
    healAmount: number;
}

interface ExecutionResult {
    success: boolean;
    error?: string;
}

export class RepairEffectManager {
    private static processedRepairActions: Set<string> = new Set();

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
                const cardData = CardDatabaseManager.getCardDetails(unit.cardId);
                
                if (cardData?.effects?.rules) {
                    // Look for repair abilities
                    cardData.effects.rules.forEach((effect: any) => {
                        if (effect.trigger === 'END_OF_TURN' && effect.action === 'heal') {
                            // Create unique key for this repair action per turn
                            const repairKey = `${unit.carduid}_${effect.effectId}_turn_${gameEnv.currentTurn}`;
                            
                            // Only add if not processed this turn
                            if (!this.processedRepairActions.has(repairKey)) {
                                console.log(`🩹 Found repair ability: ${effect.effectId} on ${unit.cardId}`);
                                
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

    /**
     * EVENT GENERATION: Create repair event with minimal data
     */
    static createRepairEvent(carduid: string, healAmount: number): GameEvent {
        return {
            id: `repair_${carduid}_${Date.now()}`,
            type: EventType.TRIGGER_HEALING,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            timestamp: Date.now(),
            data: {
                carduid,
                healAmount
            } as RepairEventData
        };
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
        for (const key of this.processedRepairActions) {
            if (!key.includes(`_turn_${currentTurn}`)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => this.processedRepairActions.delete(key));
    }
}