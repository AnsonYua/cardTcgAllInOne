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
import { TemporaryEffect, UnitZoneCard, PilotZoneCard } from '../models/CardSystem';
import { v4 as uuidv4 } from 'uuid';

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
    carduid: string;
    cardId: string;
    zone: string;
    playerId: string;
    cardData?: any;     // For display purposes
}

export interface EffectDefinition {
    effectId: string;
    type?: string;
    trigger?: string;
    target?: TargetConfig;
    action: string;         // 'modifyAP', 'damage', 'rest', etc.
    parameters?: any;       // Effect parameters
    timing?: {
        duration?: string;
        actionTurn?: string;
    };
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
        sourceCarduid: string,
        effect: EffectDefinition
    ): TargetChoiceResult {
        const effectLabel = effect.effectId || effect.action || 'unknown';
        console.log(`🎯 Processing effect ${effectLabel} requiring target selection`);

        try {
            const targetConfig = this.resolveTargetConfig(effect);
            const sourceCardId = this.deriveSourceCardId(sourceCarduid);
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
                // Create TARGET_CHOICE event for player selection - pass objects directly
                const choiceEvent = EventFactory.createTargetChoiceEvent({
                    playerId,
                    sourceCarduid,
                    effect,
                    availableTargets
                });
                
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
                const result = this.applyEffectToTargets(gameEnv, effect, targetsToApply, playerId, sourceCarduid, sourceCardId);
                
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
        try {
            if (event.status !== EventStatus.RESOLVING) {
                console.log(`⚠️ Unexpected event status: ${event.status} (expected RESOLVING)`);
                return { success: true }; // Skip - should not happen in correct flow
            }

            // Get event data object directly without destructuring to minimize conversions
            const eventData = event.data;
            
            // Use selectedTargets directly from eventData, normalizing to array if needed
            const selectedTargets = eventData.selectedTargets || 
                                  (eventData.selectedTarget ? [eventData.selectedTarget] : null);

            if (!selectedTargets) {
                return {
                    success: false,
                    error: 'No targets selected for effect'
                };
            }

            if (!selectedTargets || selectedTargets.length === 0) {
                return {
                    success: false,
                    error: 'No targets selected for effect'
                };
            }

            // Apply effect to selected targets - pass eventData object directly to minimize conversions
            const result = this.applyEffectToTargets(
                gameEnv,
                eventData.effect,
                selectedTargets,
                eventData.playerId,
                eventData.sourceCarduid,
                this.deriveSourceCardId(eventData.sourceCarduid)
            );

            if (!result.success) {
                console.log(`❌ Failed to apply effect to selected targets: ${result.error}`);
                return result;
            }

            console.log(`✅ Successfully applied ${eventData.effect.effectId} to ${selectedTargets.length} selected target(s)`);
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
                            carduid: unit.carduid,
                            cardId: unit.cardId,
                            zone: slotName,
                            playerId: targetPlayerId,
                            cardData: unit.cardData
                        });
                        console.log(`✅ Added unit target: ${unit.carduid} in ${slotName}`);
                    }
                }
                
                // Check pilot targets
                if (targetConfig.type === 'pilot' && SlotZoneUtils.hasPilot(slotZone)) {
                    const pilot = SlotZoneUtils.getPilot(slotZone);
                    if (pilot && this.validateTargetFilters(pilot, targetConfig.filters || {})) {
                        targets.push({
                            carduid: pilot.carduid,
                            cardId: pilot.cardId,
                            zone: slotName,
                            playerId: targetPlayerId,
                            cardData: pilot.cardData
                        });
                        console.log(`✅ Added pilot target: ${pilot.carduid} in ${slotName}`);
                    }
                }
            }
        }
        
        console.log(`🎯 Generated ${targets.length} valid targets`);
        return targets;
    }

    /**
     * Derive complete target configuration using effect defaults when necessary
     */
    private static resolveTargetConfig(effect: EffectDefinition): TargetConfig {
        const defaultConfig: TargetConfig = {
            type: 'unit',
            scope: 'opponent',
            count: 1,
            filters: {}
        };

        const rawTarget: Partial<TargetConfig> | undefined = (effect as any)?.target;
        if (!rawTarget) {
            return defaultConfig;
        }

        return {
            type: rawTarget.type || defaultConfig.type,
            scope: rawTarget.scope || defaultConfig.scope,
            count: typeof rawTarget.count === 'number' && rawTarget.count > 0 ? rawTarget.count : defaultConfig.count,
            filters: rawTarget.filters || defaultConfig.filters
        };
    }

    /**
     * Extract source cardId from composite carduid identifier
     */
    private static deriveSourceCardId(sourceCarduid?: string): string | undefined {
        if (!sourceCarduid) {
            return undefined;
        }

        const parts = sourceCarduid.split('_').filter(Boolean);
        if (parts.length === 0) {
            return undefined;
        }

        return parts[parts.length - 1];
    }

    /**
     * Apply effect to selected targets using unified application logic
     */
    static applyEffectToTargets(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        selectedTargets: TargetReference[],
        sourcePlayerId: string,
        sourceCarduid?: string,
        sourceCardId?: string
    ): { success: boolean; error?: string } {
        
        console.log(`⚡ Applying effect ${effect.action} to ${selectedTargets.length} target(s)`);
        
        try {
            // Apply immediate effect to all targets
            for (const target of selectedTargets) {
                const result = this.applyEffectToSingleTarget(gameEnv, effect, target, sourcePlayerId);
                if (!result.success) {
                    console.error(`❌ Failed to apply effect to target ${target.carduid}: ${result.error}`);
                    return result;
                }
            }
            
            // Create temporary effect if duration-based
            if (effect.timing?.duration === 'UNTIL_END_OF_TURN' && sourceCarduid && sourceCardId) {
                this.createTemporaryEffect(gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid, sourceCardId);
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
        
        console.log(`🎯 Applying ${effect.action} to target: ${target.carduid} in ${target.zone}`);
        
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
            const cardResult = SlotZoneUtils.findCardByUid(slotZone, target.carduid);
            if (!cardResult) {
                return {
                    success: false,
                    error: `Target card ${target.carduid} not found in ${target.zone}`
                };
            }
            
            const targetCard = cardResult.card;
            
            // Apply effect based on action type - use effect object directly to minimize conversions
            switch (effect.action) {
                case 'modifyAP':
                    const apValue = effect.parameters?.value || 0;
                    targetCard.modifyAP = apValue;
                    console.log(`⚔️ Modified ${targetCard.carduid} AP by ${apValue}`);
                    break;
                    
                case 'modifyHP':
                    const hpValue = effect.parameters?.value || 0;
                    const originalHP = targetCard.currentHP || targetCard.cardData?.hp || 0;
                    targetCard.currentHP = Math.max(0, originalHP + hpValue);
                    console.log(`❤️ Modified ${target.carduid} HP by ${hpValue}, from ${originalHP} to ${targetCard.currentHP}`);
                    break;
                    
                case 'damage':
                    const damageValue = effect.parameters?.value || 0;
                    targetCard.damageReceived = (targetCard.damageReceived || 0) + damageValue;
                    console.log(`🩸 ${target.carduid} takes ${damageValue} damage (total: ${targetCard.damageReceived})`);
                    break;
                    
                case 'rest':
                    targetCard.isRested = true;
                    console.log(`💤 ${target.carduid} has been rested`);
                    break;
                    
                case 'heal':
                    const healValue = effect.parameters?.value || 0;
                    const healAmount = Math.min(healValue, targetCard.damageReceived || 0);
                    targetCard.damageReceived = (targetCard.damageReceived || 0) - healAmount;
                    console.log(`🩹 ${target.carduid} healed ${healAmount} damage`);
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
     * Create temporary effect for UNTIL_END_OF_TURN duration effects
     * Now stores effects directly on target units instead of player level
     */
    private static createTemporaryEffect(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        selectedTargets: TargetReference[],
        sourcePlayerId: string,
        sourceCarduid: string,
        sourceCardId: string
    ): void {
        
        console.log(`⏰ Creating temporary effect: ${effect.effectId} until end of turn`);
        
        // Use effect object directly to minimize conversions 
        
        // Apply effect to each target unit directly
        for (const target of selectedTargets) {
            const targetPlayer = gameEnv.getPlayer(target.playerId);
            if (!targetPlayer) {
                console.error(`❌ Target player ${target.playerId} not found for temporary effect`);
                continue;
            }
            
            // Get the target card (unit or pilot)
            const slotResult = SlotZoneUtils.getSlotZone(targetPlayer.zones, target.zone);
            if (!slotResult.isValid || !slotResult.slot) {
                console.log(`⚠️ Target zone ${target.zone} not found: ${slotResult.error}`);
                continue;
            }
            
            const cardResult = SlotZoneUtils.findCardByUid(slotResult.slot, target.carduid);
            if (!cardResult) {
                console.log(`⚠️ Target card ${target.carduid} not found in ${target.zone}`);
                continue;
            }
            
            const targetCard = cardResult.card as UnitZoneCard | PilotZoneCard;
            
            // Create the temporary effect for this specific unit - use effect object directly
            const tempEffect: TemporaryEffect = {
                sourceCarduid: sourceCarduid,
                modifyAP: effect.action === 'modifyAP' ? effect.parameters?.value : undefined,
                modifyHP: effect.action === 'modifyHP' ? effect.parameters?.value : undefined,
                duration: effect.timing?.duration as string || 'UNTIL_END_OF_TURN',
                appliedTurn: gameEnv.currentTurn,
                appliedBy: sourcePlayerId
            };
            
            // Initialize temporaryEffects array if it doesn't exist
            if (!targetCard.temporaryEffects) {
                targetCard.temporaryEffects = [];
            }
            
            // Add the effect directly to the target card
            targetCard.temporaryEffects.push(tempEffect);
            
            // Apply the effect immediately to the card's modifiers - use tempEffect object directly
            if (tempEffect.modifyAP !== undefined) {
                targetCard.modifyAP = (targetCard.modifyAP || 0) + tempEffect.modifyAP;
                console.log(`✅ Applied AP effect ${tempEffect.modifyAP} to ${target.carduid} (new modifyAP: ${targetCard.modifyAP})`);
            }
            
            if (tempEffect.modifyHP !== undefined) {
                targetCard.modifyHP = (targetCard.modifyHP || 0) + tempEffect.modifyHP;
                console.log(`✅ Applied HP effect ${tempEffect.modifyHP} to ${target.carduid} (new modifyHP: ${targetCard.modifyHP})`);
            }
            
            console.log(`✅ Added temporary effect from ${sourceCarduid} to unit ${target.carduid}`);
        }
    }

    /**
     * Clean up expired temporary effects at end of turn
     * Now works with unit-stored effects instead of player-level effects
     */
    static cleanupExpiredTemporaryEffects(gameEnv: GameEnvironment, endingPlayerId: string): void {
        console.log(`🧹 Cleaning up temporary effects for player ${endingPlayerId} (turn ${gameEnv.currentTurn})`);
        
        let totalExpiredCount = 0;
        
        // Clean up effects on all players' units (effects applied by the ending player)
        for (const playerId of Object.keys(gameEnv.players)) {
            const player = gameEnv.getPlayer(playerId);
            if (!player) continue;
            
            // Check all slot zones for units with temporary effects
            for (const slotName of SLOT_ZONES) {
                const slot = player.zones[slotName];
                
                // Clean up unit effects
                if (slot.unit?.temporaryEffects) {
                    const initialCount = slot.unit.temporaryEffects.length;
                    slot.unit.temporaryEffects = slot.unit.temporaryEffects.filter(tempEffect => {
                        const shouldExpire = tempEffect.duration === 'UNTIL_END_OF_TURN' && 
                                            tempEffect.appliedTurn === gameEnv.currentTurn &&
                                            tempEffect.appliedBy === endingPlayerId;
                        
                        if (shouldExpire) {
                            console.log(`⏰ Expiring temporary effect from ${tempEffect.sourceCarduid} on unit ${slot.unit!.carduid}`);
                            this.revertTemporaryEffectFromUnit(slot.unit!, tempEffect);
                        }
                        
                        return !shouldExpire;
                    });
                    totalExpiredCount += initialCount - slot.unit.temporaryEffects.length;
                }
                
                // Clean up pilot effects
                if (slot.pilot?.temporaryEffects) {
                    const initialCount = slot.pilot.temporaryEffects.length;
                    slot.pilot.temporaryEffects = slot.pilot.temporaryEffects.filter(tempEffect => {
                        const shouldExpire = tempEffect.duration === 'UNTIL_END_OF_TURN' && 
                                            tempEffect.appliedTurn === gameEnv.currentTurn &&
                                            tempEffect.appliedBy === endingPlayerId;
                        
                        if (shouldExpire) {
                            console.log(`⏰ Expiring temporary effect from ${tempEffect.sourceCarduid} on pilot ${slot.pilot!.carduid}`);
                            this.revertTemporaryEffectFromUnit(slot.pilot!, tempEffect);
                        }
                        
                        return !shouldExpire;
                    });
                    totalExpiredCount += initialCount - slot.pilot.temporaryEffects.length;
                }
            }
        }
        
        console.log(`✅ Cleaned up ${totalExpiredCount} expired temporary effects applied by player ${endingPlayerId}`);
    }
    
    /**
     * Revert a temporary effect from a specific unit
     * Simplified to work directly on the unit instead of searching through targets
     */
    private static revertTemporaryEffectFromUnit(unit: UnitZoneCard | PilotZoneCard, tempEffect: TemporaryEffect): void {
        console.log(`🔄 Reverting temporary effect from ${tempEffect.sourceCarduid} on unit ${unit.carduid}`);
        
        // Revert effects directly from the unit's modifiers
        if (tempEffect.modifyAP !== undefined) {
            const currentAP = unit.modifyAP || 0;
            unit.modifyAP = currentAP - tempEffect.modifyAP;
            console.log(`🔄 Reverted AP modification on ${unit.carduid}: ${currentAP} → ${unit.modifyAP}`);
        }
        
        if (tempEffect.modifyHP !== undefined) {
            const currentHP = unit.modifyHP || 0;
            unit.modifyHP = currentHP - tempEffect.modifyHP;
            console.log(`🔄 Reverted HP modification on ${unit.carduid}: ${currentHP} → ${unit.modifyHP}`);
        }
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
                console.log(`❌ Card ${card.carduid} failed level filter: ${filters.level}`);
                return false;
            }
        }
        
        // HP filter (from deploy effects)
        if (filters.hp) {
            const currentHp = (card.currentHP || 0) + (card.modifyHP || 0);
            if (!this.validateComparisonFilter(currentHp, filters.hp)) {
                console.log(`❌ Card ${card.carduid} failed HP filter: ${filters.hp}`);
                return false;
            }
        }
        
        // Status filter
        if (filters.status) {
            const cardStatus = card.isRested ? 'rested' : 'active';
            if (cardStatus !== filters.status) {
                console.log(`❌ Card ${card.carduid} failed status filter: expected ${filters.status}, got ${cardStatus}`);
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
                console.log(`❌ Card ${card.carduid} failed trait filter: required ${filters.traits}, has ${cardTraits}`);
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
