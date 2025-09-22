/**
 * Unified Target Choice Manager
 * 
 * Handles all target selection scenarios including:
 * - Deploy effects requiring player choice
 * - Pairing effects with multiple eligible targets  
 * - Future effect types requiring target selection
 * 
 * Replaces DEPLOY_TARGET_CHOICE with unified TARGET_CHOICE system.
 */

import { GameEnvironment } from '../models/GameEnvironment';
import { EventFactory, EventStatus } from './EventQueue/interfaces/GameEvent';
import { EventType } from '../models/GameEnums';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';

export interface TargetConfig {
    type: 'unit' | 'pilot' | 'card';
    scope: 'self' | 'opponent' | 'any';
    count: number;
    filters?: {
        level?: string;     // "<=5", ">=3"
        hp?: string;        // "<=2", ">1"
        status?: string;    // "rested", "active"
        traits?: string[];  // ["Academy", "Earth Federation"]
        zone?: string[];    // ["slot1", "slot2"] - specific zones only
    };
}

export interface TargetReference {
    cardUid: string;
    cardId: string;
    zone: string;
    playerId: string;
    cardData?: any;     // For display purposes
}

export interface EffectDefinition {
    effectId: string;
    action: string;         // 'modifyAP', 'damage', 'rest', etc.
    parameters: any;        // Effect parameters
    description?: string;
}

export interface TargetChoiceResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;    // true if TARGET_CHOICE event created
    autoApplied?: boolean;         // true if effect auto-applied (single target)
    affectedTargets?: TargetReference[];
}


export class TargetChoiceManager {

    /**
     * Main entry point: Process effect that may require target selection
     * 
     * Logic:
     * - If multiple targets available and count=1 → Create TARGET_CHOICE event
     * - If single target available → Auto-apply effect
     * - If no targets available → Effect succeeds but does nothing
     */
    static processEffectWithTargetChoice(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceType: 'DEPLOY' | 'PAIRING' | 'ACTIVATION',
        sourceCardUid: string,
        sourceCardId: string,
        effect: EffectDefinition,
        targetConfig: TargetConfig,
        sourceSlot?: string
    ): TargetChoiceResult {
        
        console.log(`🎯 Processing ${sourceType} effect: ${effect.effectId} requiring target selection`);
        
        try {
            // Generate available targets based on config
            const availableTargets = this.generateAvailableTargets(gameEnv, playerId, targetConfig);
            
            if (availableTargets.length === 0) {
                console.log(`⚠️ No eligible targets found for ${effect.effectId}`);
                return { 
                    success: true, 
                    autoApplied: true,
                    affectedTargets: [] 
                };
            }
            
            // Decision logic: Choice vs Auto-application
            if (this.requiresPlayerChoice(targetConfig, availableTargets)) {
                // Create TARGET_CHOICE event for player selection
                const choiceEvent = EventFactory.createTargetChoiceEvent(
                    playerId,
                    sourceType,
                    sourceCardUid,
                    sourceCardId,
                    effect,
                    targetConfig,
                    availableTargets,
                    sourceSlot
                );
                
                // Add to processing queue for game event processing
                gameEnv.processingQueue.push(choiceEvent);
                
                console.log(`🎮 Created TARGET_CHOICE event ${choiceEvent.id} with ${availableTargets.length} targets`);
                return { 
                    success: true, 
                    requiresSelection: true 
                };
                
            } else {
                // Auto-apply to single target or all targets (based on count)
                const targetsToApply = availableTargets.slice(0, targetConfig.count);
                const result = this.applyEffectToTargets(gameEnv, effect, targetsToApply, playerId);
                
                console.log(`🤖 Auto-applied ${effect.effectId} to ${targetsToApply.length} target(s)`);
                return {
                    success: result.success,
                    error: result.error,
                    autoApplied: true,
                    affectedTargets: result.success ? targetsToApply : []
                };
            }
            
        } catch (error) {
            console.error(`❌ Error in processEffectWithTargetChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Target choice processing failed'
            };
        }
    }

    /**
     * Execute TARGET_CHOICE event when player makes selection
     */
    static executeTargetChoice(event: any, gameEnv: GameEnvironment): { success: boolean; error?: string } {
        console.log(`🎯 Executing TARGET_CHOICE event: ${event.id} (${event.status})`);
        console.log("adsfdsafsdfads 11111 1",JSON.stringify(event))
        try {
            if (event.status !== EventStatus.RESOLVING) {
                console.log(`⚠️ Unexpected event status: ${event.status} (expected RESOLVING)`);
                return { success: true }; // Skip - should not happen in correct flow
            }

            // Handle both singular and plural target selection formats
            let selectedTargets;
            if (event.data.selectedTargets) {
                // Array format from multi-target selection
                selectedTargets = event.data.selectedTargets;
            } else if (event.data.selectedTarget) {
                // Single object format from frontend - convert to array
                selectedTargets = [event.data.selectedTarget];
            } else {
                return {
                    success: false,
                    error: 'No targets selected for effect'
                };
            }

            const { effect, playerId } = event.data;

            if (!selectedTargets || selectedTargets.length === 0) {
                return {
                    success: false,
                    error: 'No targets selected for effect'
                };
            }

            // Apply effect to selected targets
            const result = this.applyEffectToTargets(gameEnv, effect, selectedTargets, playerId);

            if (!result.success) {
                console.log(`❌ Failed to apply effect to selected targets: ${result.error}`);
                return result;
            }

            console.log(`✅ Successfully applied ${effect.effectId} to ${selectedTargets.length} selected target(s)`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeTargetChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Target choice execution failed'
            };
        }
    }

    /**
     * Generate available targets based on target configuration
     */
    static generateAvailableTargets(
        gameEnv: GameEnvironment, 
        playerId: string, 
        targetConfig: TargetConfig
    ): TargetReference[] {
        
        const targets: TargetReference[] = [];
        
        console.log(`🔍 Generating targets for config:`, JSON.stringify(targetConfig, null, 2));
        
        // Determine target player based on scope
        const targetPlayerIds = this.getTargetPlayerIds(gameEnv, playerId, targetConfig.scope);
        
        for (const targetPlayerId of targetPlayerIds) {
            const player = gameEnv.getPlayer(targetPlayerId);
            if (!player) {
                console.error(`❌ Target player ${targetPlayerId} not found`);
                continue;
            }
            
            console.log(`🎯 Searching player ${targetPlayerId} for valid targets`);
            
            // Search specified zones (or all slot zones by default)
            const zonesToSearch = targetConfig.filters?.zone || SLOT_ZONES;
            
            for (const slotName of zonesToSearch) {
                // Use type-safe slot validation
                const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
                if (!slotResult.isValid || !slotResult.slot) {
                    console.log(`⚠️ Skipping invalid slot ${slotName}: ${slotResult.error}`);
                    continue;
                }
                
                const slotZone = slotResult.slot;
                
                // Check unit targets
                if (targetConfig.type === 'unit' && SlotZoneUtils.hasUnit(slotZone)) {
                    const unit = SlotZoneUtils.getUnit(slotZone);
                    if (unit && this.validateTargetFilters(unit, targetConfig.filters || {})) {
                        targets.push({
                            cardUid: unit.cardUid,
                            cardId: unit.cardId,
                            zone: slotName,
                            playerId: targetPlayerId,
                            cardData: unit.cardData
                        });
                        console.log(`✅ Added unit target: ${unit.cardUid} in ${slotName}`);
                    }
                }
                
                // Check pilot targets
                if (targetConfig.type === 'pilot' && SlotZoneUtils.hasPilot(slotZone)) {
                    const pilot = SlotZoneUtils.getPilot(slotZone);
                    if (pilot && this.validateTargetFilters(pilot, targetConfig.filters || {})) {
                        targets.push({
                            cardUid: pilot.cardUid,
                            cardId: pilot.cardId,
                            zone: slotName,
                            playerId: targetPlayerId,
                            cardData: pilot.cardData
                        });
                        console.log(`✅ Added pilot target: ${pilot.cardUid} in ${slotName}`);
                    }
                }
            }
        }
        
        console.log(`🎯 Generated ${targets.length} valid targets`);
        return targets;
    }

    /**
     * Apply effect to selected targets using unified application logic
     */
    static applyEffectToTargets(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        selectedTargets: TargetReference[],
        sourcePlayerId: string
    ): { success: boolean; error?: string } {
        
        console.log(`⚡ Applying effect ${effect.action} to ${selectedTargets.length} target(s)`);
        
        try {
            for (const target of selectedTargets) {
                const result = this.applyEffectToSingleTarget(gameEnv, effect, target, sourcePlayerId);
                if (!result.success) {
                    console.error(`❌ Failed to apply effect to target ${target.cardUid}: ${result.error}`);
                    return result;
                }
            }
            
            console.log(`✅ Successfully applied ${effect.action} to all ${selectedTargets.length} target(s)`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error applying effect to targets:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Effect application failed'
            };
        }
    }

    /**
     * Apply effect to a single target - unified logic for all effect types
     */
    private static applyEffectToSingleTarget(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        target: TargetReference,
        sourcePlayerId: string
    ): { success: boolean; error?: string } {
        
        console.log(`🎯 Applying ${effect.action} to target: ${target.cardUid} in ${target.zone}`);
        
        try {
            // Get target player and slot
            const targetPlayer = gameEnv.getPlayer(target.playerId);
            if (!targetPlayer) {
                return {
                    success: false,
                    error: `Target player ${target.playerId} not found`
                };
            }
            
            // Use type-safe slot validation
            const slotResult = SlotZoneUtils.getSlotZone(targetPlayer.zones, target.zone);
            if (!slotResult.isValid || !slotResult.slot) {
                return {
                    success: false,
                    error: `Target zone ${target.zone} not found or invalid: ${slotResult.error}`
                };
            }
            
            const slotZone = slotResult.slot;
            
            // Find the target card using utility function
            const cardResult = SlotZoneUtils.findCardByUid(slotZone, target.cardUid);
            if (!cardResult) {
                return {
                    success: false,
                    error: `Target card ${target.cardUid} not found in ${target.zone}`
                };
            }
            
            const targetCard = cardResult.card;
            
            // Apply effect based on action type
            const value = effect.parameters?.value || 0;
            
            switch (effect.action) {
                case 'modifyAP':
                    targetCard.modifyAP = value;
                    console.log(`⚔️ Modified 1111111${targetCard.modifyAP} `);
                    break;
                    
                case 'modifyHP':
                    const originalHP = targetCard.currentHP || targetCard.cardData?.hp || 0;
                    targetCard.currentHP = Math.max(0, originalHP + value);
                    console.log(`❤️ Modified ${target.cardUid} HP by ${value}, from ${originalHP} to ${targetCard.currentHP}`);
                    break;
                    
                case 'damage':
                    targetCard.damageReceived = (targetCard.damageReceived || 0) + value;
                    console.log(`🩸 ${target.cardUid} takes ${value} damage (total: ${targetCard.damageReceived})`);
                    break;
                    
                case 'rest':
                    targetCard.isRested = true;
                    console.log(`💤 ${target.cardUid} has been rested`);
                    break;
                    
                case 'heal':
                    const healAmount = Math.min(value, targetCard.damageReceived || 0);
                    targetCard.damageReceived = (targetCard.damageReceived || 0) - healAmount;
                    console.log(`🩹 ${target.cardUid} healed ${healAmount} damage`);
                    break;
                    
                default:
                    console.log(`⚠️ Unknown effect action: ${effect.action}`);
                    return {
                        success: false,
                        error: `Unknown effect action: ${effect.action}`
                    };
            }
            
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error applying effect to single target:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Single target effect application failed'
            };
        }
    }

    /**
     * Determine if player choice is required
     * 
     * Logic:
     * - If count=1 and multiple targets available → Requires choice
     * - If count>1 → Always requires choice (select multiple)
     * - If only one target or auto-select scenarios → No choice needed
     */
    private static requiresPlayerChoice(targetConfig: TargetConfig, availableTargets: TargetReference[]): boolean {
        // Multiple target selection always requires choice
        if (targetConfig.count > 1) {
            return availableTargets.length > 0;
        }
        
        // Single target selection requires choice only if multiple options
        if (targetConfig.count === 1) {
            return availableTargets.length > 1;
        }
        
        // Zero or negative count - no choice needed
        return false;
    }

    /**
     * Get target player IDs based on scope
     */
    private static getTargetPlayerIds(gameEnv: GameEnvironment, playerId: string, scope: string): string[] {
        switch (scope) {
            case 'self':
                return [playerId];
            case 'opponent':
                const opponentId = gameEnv.getOpponentId(playerId);
                return opponentId ? [opponentId] : [];
            case 'any':
                return Object.keys(gameEnv.players);
            default:
                console.log(`⚠️ Unknown target scope: ${scope}`);
                return [];
        }
    }

    /**
     * Unified target validation with all filter types
     */
    private static validateTargetFilters(card: any, filters: any): boolean {
        // Level filter (from pairing effects)
        if (filters.level) {
            const cardLevel = card.cardData?.level || 0;
            if (!this.validateComparisonFilter(cardLevel, filters.level)) {
                console.log(`❌ Card ${card.cardUid} failed level filter: ${filters.level}`);
                return false;
            }
        }
        
        // HP filter (from deploy effects)
        if (filters.hp) {
            const currentHp = (card.currentHP || 0) + (card.modifyHP || 0);
            if (!this.validateComparisonFilter(currentHp, filters.hp)) {
                console.log(`❌ Card ${card.cardUid} failed HP filter: ${filters.hp}`);
                return false;
            }
        }
        
        // Status filter
        if (filters.status) {
            const cardStatus = card.isRested ? 'rested' : 'active';
            if (cardStatus !== filters.status) {
                console.log(`❌ Card ${card.cardUid} failed status filter: expected ${filters.status}, got ${cardStatus}`);
                return false;
            }
        }
        
        // Trait filter
        if (filters.traits && filters.traits.length > 0) {
            const cardTraits = card.cardData?.traits || [];
            const hasRequiredTrait = filters.traits.some((requiredTrait: string) =>
                cardTraits.some((cardTrait: string) => cardTrait === requiredTrait)
            );
            if (!hasRequiredTrait) {
                console.log(`❌ Card ${card.cardUid} failed trait filter: required ${filters.traits}, has ${cardTraits}`);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Unified comparison filter validation (handles both HP and level filters)
     */
    private static validateComparisonFilter(value: number, filterString: string): boolean {
        // Parse filter string like "<=5", ">=3", ">1", etc.
        const match = filterString.match(/^(<=|>=|<|>|==|!=)(\d+)$/);
        if (!match) {
            console.log(`⚠️ Invalid filter format: ${filterString}`);
            return false;
        }
        
        const operator = match[1];
        const filterValue = parseInt(match[2], 10);
        
        console.log(`🔍 Filter validation: ${value} ${operator} ${filterValue}`);
        
        switch (operator) {
            case '<=':
                return value <= filterValue;
            case '>=':
                return value >= filterValue;
            case '<':
                return value < filterValue;
            case '>':
                return value > filterValue;
            case '==':
                return value === filterValue;
            case '!=':
                return value !== filterValue;
            default:
                console.log(`⚠️ Unsupported comparison operator: ${operator}`);
                return false;
        }
    }
}