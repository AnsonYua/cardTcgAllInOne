// src/services/CardEffect.ts
// Universal card effect processor for all effect types

import { GameEnvironment } from '../models/GameEnvironment';
import { HandCard } from '../models/Player';
import { ZoneCard } from '../models/CardSystem';
import { 
    StoredContinuousEffect, 
    ContinuousEffectsHelper, 
    createEmptyContinuousEffectsCollection,
    EffectProcessingResult,
    findEffectByKey,
    getEffectUniqueKey
} from '../models/ContinuousEffects';

// Continuous effect types
export enum ContinuousEffectType {
    ALWAYS_ACTIVE = 'ALWAYS_ACTIVE',
    PAIR_TRIGGERED = 'PAIR_TRIGGERED', 
    LINK_TRIGGERED = 'LINK_TRIGGERED'
}

// Slot state interface
export interface SlotState {
    hasUnit: boolean;
    hasPilot: boolean;
    isPaired: boolean;
    isLinked: boolean;
}

export interface EffectResult {
    success: boolean;
    message?: string;
    error?: string;
    affectedCards?: any[];
    // REMOVED: requiresSelection and selection - all effects now process automatically
}

/**
 * Universal CardEffect class that handles any card effect based on JSON structure
 * Works with any target, action, and parameters combination
 */
export class CardEffect {
    
    /**
     * Static method to execute repair effects from StateBasedActionEngine
     */
    static executeRepairEffect(gameEnv: GameEnvironment, repairData: any): EffectResult {
        // Handle both data structures: direct fields or nested in data
        const eventData = repairData.data || repairData;
        const cardId = eventData.cardId || (repairData.affectedCards && repairData.affectedCards[0]);
        const cardUid = eventData.cardUid;
        const playerId = eventData.playerId || (repairData.affectedPlayers && repairData.affectedPlayers[0]);
        const healAmount = eventData.healAmount || 2; // Default to 2 for repair_2
        
        console.log(`🩹 Static repair execution: ${healAmount} HP for ${cardId} (${cardUid || 'unknown UID'})`);
        
        // Find the target unit
        const player = gameEnv.players[playerId];
        if (!player || !player.zones) {
            return {
                success: false,
                error: 'Player not found'
            };
        }
        
        // Find unit in slot zones
        const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
        let targetUnit = null;
        
        for (const slot of slotZones) {
            const slotZone = (player.zones as any)[slot];
            if (slotZone?.unit) {
                // First try to match by cardUid if available
                if (cardUid && slotZone.unit.cardUid === cardUid) {
                    targetUnit = slotZone.unit;
                    break;
                }
                // Fallback to matching by cardId
                else if (cardId && slotZone.unit.cardId === cardId) {
                    targetUnit = slotZone.unit;
                    break;
                }
            }
        }
        
        if (!targetUnit) {
            console.log(`❌ Could not find target unit with cardId: ${cardId}, cardUid: ${cardUid} for player: ${playerId}`);
            return {
                success: false,
                error: `Target unit not found (cardId: ${cardId}, cardUid: ${cardUid})`
            };
        }
        
        // Get card data to check max HP
        const cardData = CardEffect.getStaticCardData(cardId);
        if (!cardData) {
            return {
                success: false,
                error: 'Card data not found'
            };
        }
        
        const maxHP = cardData.hp;
        const currentHP = targetUnit.currentHP || maxHP;
        console.log("healing effect 111", JSON.stringify(currentHP))
        // Calculate actual healing (can't exceed max HP)
        const newHP = Math.min(currentHP + healAmount, maxHP);
        const actualHealing = newHP - currentHP;
        console.log("healing effect 111222", JSON.stringify(newHP))
        console.log("healing effect 11122233", JSON.stringify(healAmount))
        if (actualHealing > 0) {
            // Apply healing
            targetUnit.currentHP = newHP;
            
            console.log(`✅ Repaired ${cardId} for ${actualHealing} HP (${currentHP} → ${newHP}/${maxHP})`);
            
            return {
                success: true,
                message: `Repaired ${cardId} for ${actualHealing} HP`,
                affectedCards: [targetUnit]
            };
        } else {
            console.log(`ℹ️ ${cardId} already at max HP (${currentHP}/${maxHP}) - no repair needed`);
            
            return {
                success: true,
                message: `${cardId} already at max HP - no repair needed`,
                affectedCards: []
            };
        }
    }
    
    /**
     * Static helper to get card data
     */
    private static getStaticCardData(cardId: string): any {
        try {
            const GameEngine = require('./GameEngine');
            return GameEngine.GameEngine.getCardDetails(cardId);
        } catch (error) {
            console.error(`❌ Error loading card data for ${cardId}:`, error);
            return null;
        }
    }

    // ============================================================================
    // CONTINUOUS EFFECT PROCESSING METHODS (Moved from ContinuousEffectManager)
    // ============================================================================

    /**
     * Find continuous effects that trigger on pairing
     */
    static findPairContinuousEffects(card: ZoneCard): any[] {
        const effects = card.cardData?.effects?.rules || [];
        return effects.filter(rule => {
            const trigger = CardEffect.extractTrigger(rule);
            const conditions = CardEffect.extractConditions(rule);
            return trigger === 'continuous' && conditions.includes('isPaired');
        });
    }

    /**
     * PHASE 1: Add effects to all units owned by the player (storage only)
     */
    static addEffectToAllPlayerUnits(
        effectRule: any, 
        sourceCard: ZoneCard, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        const scope = CardEffect.extractTargetScope(effectRule);
        if (scope !== 'self_all') return false;
        
        const targetUnits = CardEffect.getAllPlayerUnits(playerId, gameEnv);
        const effectId = CardEffect.extractEffectId(effectRule);
        
        let addedCount = 0;
        for (const unit of targetUnits) {
            if (CardEffect.addContinuousEffect(unit, effectRule, sourceCard, effectId)) {
                addedCount++;
            }
        }
        
        console.log(`💾 Added effects to ${addedCount}/${targetUnits.length} units`);
        return addedCount > 0;
    }
    
    /**
     * PHASE 2: Apply all continuous effects to all player units
     */
    static applyEffectsToAllPlayerUnits(playerId: string, gameEnv: GameEnvironment): number {
        const targetUnits = CardEffect.getAllPlayerUnits(playerId, gameEnv);
        let totalApplied = 0;
        
        for (const unit of targetUnits) {
            totalApplied += CardEffect.applyContinuousEffects(unit, gameEnv);
        }
        
        console.log(`✅ Applied ${totalApplied} effects to ${targetUnits.length} units for player ${playerId}`);
        return totalApplied;
    }
    
    /**
     * Legacy method name for backward compatibility
     */
    static applyEffectToAllPlayerUnits(
        effectRule: any, 
        sourceCard: ZoneCard, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        return CardEffect.addEffectToAllPlayerUnits(effectRule, sourceCard, playerId, gameEnv);
    }

    /**
     * Extract all unit cards for a player
     */
    static getAllPlayerUnits(playerId: string, gameEnv: GameEnvironment): ZoneCard[] {
        const player = gameEnv.players[playerId];
        if (!player?.zones) return [];
        
        const units: ZoneCard[] = [];
        const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
        
        for (const slotName of slotZones) {
            const unit = (player.zones as any)[slotName]?.unit;
            if (unit) units.push(unit);
        }
        
        return units;
    }

    /**
     * PHASE 1: Add continuous effect to storage only (no immediate application)
     */
    static addContinuousEffect(
        targetCard: ZoneCard, 
        effectRule: any, 
        sourceCard: ZoneCard, 
        effectId: string
    ): boolean {
        // Initialize array if it doesn't exist
        if (!targetCard.continuousEffects) {
            targetCard.continuousEffects = createEmptyContinuousEffectsCollection();
        }
        
        // Extract parameters based on actual structure from st01card.json
        const effectAction = effectRule.effect?.action || 'modifyAP';
        const parameters = effectRule.effect?.parameters || {};
        
        // Calculate value for storage (but don't apply yet)
        const value = CardEffect.getEffectValue(effectAction, parameters);
        
        const storedEffect: StoredContinuousEffect = {
            effectId,
            type: effectRule.type || 'static',
            timing: effectRule.timing || ['YOUR_TURN'],
            effect: {
                action: effectAction,
                parameters: parameters,
                duration: effectRule.effect?.duration || 'while_paired'
            },
            sourceCardUid: sourceCard.cardUid,
            active: false, // Start inactive, will be activated in Phase 2
            appliedValue: 0 // Will be set when actually applied
        };
        
        // Add effect with duplicate prevention (storage only)
        const wasAdded = ContinuousEffectsHelper.addEffect(targetCard.continuousEffects, storedEffect);
        
        if (wasAdded) {
            console.log(`💾 Stored continuous effect: ${effectId} (${effectAction}) from ${sourceCard.cardUid} to ${targetCard.cardUid}`);
        } else {
            console.log(`⚠️ Skipped duplicate continuous effect: ${effectId} from ${sourceCard.cardUid} to ${targetCard.cardUid}`);
        }
        
        return wasAdded;
    }
    
    /**
     * PHASE 2: Apply all stored continuous effects to a card
     */
    static applyContinuousEffects(targetCard: ZoneCard, gameEnv: GameEnvironment): number {
        if (!targetCard.continuousEffects || targetCard.continuousEffects.length === 0) {
            return 0;
        }
        
        let appliedCount = 0;
        
        for (const storedEffect of targetCard.continuousEffects) {
            
            if (!storedEffect.active) {
                // Activate effect (simplified - always activate stored effects)
                const value = CardEffect.getEffectValue(storedEffect.effect.action, storedEffect.effect.parameters);
                
                if (CardEffect.isStatModifyingAction(storedEffect.effect.action)) {
                    CardEffect.applyEffectValue(targetCard, storedEffect.effect.action, value);
                }
                
                storedEffect.active = true;
                storedEffect.appliedValue = value;
                appliedCount++;
                
                console.log(`✅ Activated effect: ${storedEffect.effectId} (${storedEffect.effect.action}) on ${targetCard.cardUid} (value: ${value})`);
            }
        }
        
        return appliedCount;
    }
    
    /**
     * Check if effect action modifies card stats
     */
    private static isStatModifyingAction(action: string): boolean {
        return action === 'modifyAP' || action === 'modifyHP';
    }

    /**
     * Apply an effect value to a card (e.g., modify AP)
     */
    static applyEffectValue(card: ZoneCard, action: string, value: number): void {
        switch (action) {
            case 'modifyAP':
                if (card.cardData?.ap !== undefined) {
                    const currentAP = (card as any).currentAP || card.cardData.ap;
                    (card as any).currentAP = currentAP + value;
                    console.log(`⚡ Applied ${value > 0 ? '+' : ''}${value} AP to ${card.cardUid} (now ${(card as any).currentAP})`);
                }
                break;
            case 'modifyHP':
                if (card.cardData?.hp !== undefined) {
                    const currentHP = (card as any).currentHP || card.cardData.hp;
                    (card as any).currentHP = Math.max(0, currentHP + value);
                    console.log(`❤️ Applied ${value > 0 ? '+' : ''}${value} HP to ${card.cardUid} (now ${(card as any).currentHP})`);
                }
                break;
            default:
                console.log(`⚠️ Unknown effect action: ${action}`);
        }
    }

    /**
     * Parse a modifier string like "+1", "-2", "3" into a number
     */
    static parseModifier(modifier: string | number): number {
        if (typeof modifier === 'number') return modifier;
        if (typeof modifier !== 'string') return 0;
        
        // Handle common modifier formats from st01card.json
        const cleanValue = modifier.replace(/[^\d\-\+]/g, '');
        return parseInt(cleanValue, 10) || 0;
    }
    
    
    /**
     * Get effect value based on action type and parameters
     */
    static getEffectValue(action: string, parameters: any): number {
        switch (action) {
            case 'modifyAP':
            case 'modifyHP':
                return parameters.modifier ? CardEffect.parseModifier(parameters.modifier) : 0;
            case 'heal':
            case 'damage':
                return parameters.amount || 0;
            case 'addToHand':
                return parameters.count || 1;
            case 'restrict_attack':
            case 'rest':
            case 'deploy':
                // Non-numeric effects
                return 0;
            default:
                console.log(`⚠️ Unknown action type for value extraction: ${action}`);
                return 0;
        }
    }

    // ============================================================================
    // CONTINUOUS EFFECTS ORCHESTRATION (moved from ContinuousEffectManager)
    // ============================================================================

    /**
     * Main entry point - Simplified continuous effects processing
     */
    static processAllContinuousEffects(gameEnv: GameEnvironment): EffectProcessingResult {
        console.log(`🔄 Processing continuous effects (TWO-PHASE)`);
        
        try {
            let totalAdded = 0;
            let totalApplied = 0;
            
            // Process each player with internal two-phase approach
            for (const [playerId, player] of Object.entries(gameEnv.players)) {
                console.log(`💾 PHASE 1: Adding effects for player ${playerId}`);
                const playerEffectsAdded = CardEffect.processPlayerSlots(player, playerId, gameEnv);
                totalAdded += playerEffectsAdded;
                
                console.log(`✅ PHASE 2: Applying effects for player ${playerId}`);
                const playerEffectsApplied = CardEffect.applyEffectsToAllPlayerUnits(playerId, gameEnv);
                totalApplied += playerEffectsApplied;
            }
            
            console.log(`✅ Processing complete: ${totalAdded} effects added, ${totalApplied} effects applied`);
            return { success: true, effectsProcessed: totalAdded, effectsActivated: totalApplied, effectsDeactivated: 0 };
            
        } catch (error) {
            console.error(`❌ Error processing continuous effects:`, error);
            return { success: false, effectsProcessed: 0, effectsActivated: 0, effectsDeactivated: 0, error: String(error) };
        }
    }

    /**
     * Process all slots for a single player
     */
    private static processPlayerSlots(player: any, playerId: string, gameEnv: GameEnvironment): number {
        if (!player.zones) return 0;
        
        let effectCount = 0;
        const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
        
        for (const slotName of slotZones) {
            const slot = player.zones[slotName];
            if (!slot) continue;
            
            // Detect slot state for all effect types
            const slotState = CardEffect.detectSlotState(slot);
            
            // Process effects based on slot state
            effectCount += CardEffect.processSlotEffects(slot, slotState, playerId, gameEnv);
        }
        
        return effectCount;
    }

    /**
     * Detect the current state of a slot for effect processing
     */
    private static detectSlotState(slot: any): SlotState {
        const hasUnit = !!slot.unit;
        const hasPilot = !!slot.pilot;
        const isPaired = hasUnit && hasPilot;
        const isLinked = isPaired ? CardEffect.detectLink(slot.unit, slot.pilot) : false;
        
        return {
            hasUnit,
            hasPilot,
            isPaired,
            isLinked
        };
    }

    /**
     * Detect if unit and pilot form a link (unit.link matches pilot.name or traits)
     */
    private static detectLink(unit: any, pilot: any): boolean {
        if (!unit?.cardData?.link || !pilot?.cardData) return false;
        
        const unitLink = unit.cardData.link;
        const pilotName = pilot.cardData.name;
        const pilotTraits = pilot.cardData.traits || [];
        
        // Check if unit's link matches pilot's name
        if (pilotName && unitLink.includes(pilotName)) {
            return true;
        }
        
        // Check if unit's link matches any of pilot's traits
        for (const linkValue of unitLink) {
            if (pilotTraits.includes(linkValue)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Process continuous effects for a slot based on its state
     */
    private static processSlotEffects(slot: any, slotState: SlotState, playerId: string, gameEnv: GameEnvironment): number {
        let effectCount = 0;
        
        // Process unit effects
        if (slot.unit) {
            effectCount += CardEffect.processCardEffects(slot.unit, slotState, playerId, gameEnv);
        }
        
        // Process pilot effects
        if (slot.pilot) {
            effectCount += CardEffect.processCardEffects(slot.pilot, slotState, playerId, gameEnv);
        }
        
        return effectCount;
    }

    /**
     * Process continuous effects from a single card based on slot state
     */
    private static processCardEffects(card: any, slotState: SlotState, playerId: string, gameEnv: GameEnvironment): number {
        const effects = card.cardData?.effects?.rules || [];
        let appliedCount = 0;
        
        for (const effectRule of effects) {
            const trigger = CardEffect.extractTrigger(effectRule);
            if (trigger !== 'continuous') continue;
            
            const effectType = CardEffect.classifyEffectType(effectRule);
            
            // Use switch case for different effect types
            switch (effectType) {
                case ContinuousEffectType.ALWAYS_ACTIVE:
                    if (CardEffect.processAlwaysActiveEffect(effectRule, card, playerId, gameEnv)) {
                        appliedCount++;
                    }
                    break;
                    
                case ContinuousEffectType.PAIR_TRIGGERED:
                    if (slotState.isPaired && CardEffect.processPairTriggeredEffect(effectRule, card, playerId, gameEnv)) {
                        appliedCount++;
                    }
                    break;
                    
                case ContinuousEffectType.LINK_TRIGGERED:
                    if (slotState.isLinked && CardEffect.processLinkTriggeredEffect(effectRule, card, playerId, gameEnv)) {
                        appliedCount++;
                    }
                    break;
                    
                default:
                    console.log(`⚠️ Unknown continuous effect type: ${effectType}`);
            }
        }
        
        return appliedCount;
    }

    /**
     * Classify the type of continuous effect based on conditions
     */
    private static classifyEffectType(effectRule: any): ContinuousEffectType {
        const conditions = CardEffect.extractConditions(effectRule);
        
        // Check for pair-triggered effects
        if (conditions.includes('isPaired')) {
            return ContinuousEffectType.PAIR_TRIGGERED;
        }
        
        // Check for link-triggered effects (future expansion)
        if (conditions.includes('isLinked')) {
            return ContinuousEffectType.LINK_TRIGGERED;
        }
        
        // Default to always active effects (like ST01-009 "Zowort" attack restrictions)
        return ContinuousEffectType.ALWAYS_ACTIVE;
    }

    /**
     * Process always active continuous effects (PHASE 1: Storage only)
     */
    private static processAlwaysActiveEffect(
        effectRule: any, 
        sourceCard: any, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        console.log(`🔄 Processing always active effect from ${sourceCard.cardId}`);
        
        const scope = CardEffect.extractTargetScope(effectRule);
        const effectId = CardEffect.extractEffectId(effectRule);
        
        switch (scope) {
            case 'self':
            case 'self_all':
                return CardEffect.addEffectToAllPlayerUnits(effectRule, sourceCard, playerId, gameEnv);
            case 'opponent':
            case 'opponent_all':
                const opponentId = CardEffect.getOpponentId(playerId, gameEnv);
                return CardEffect.addEffectToAllPlayerUnits(effectRule, sourceCard, opponentId, gameEnv);
            default:
                console.log(`⚠️ Unknown scope pattern: ${scope}`);
                return false;
        }
    }

    /**
     * Process pair-triggered continuous effects (PHASE 1: Storage only)
     */
    private static processPairTriggeredEffect(
        effectRule: any, 
        sourceCard: any, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        console.log(`🔄 Processing pair-triggered effect from ${sourceCard.cardId}`);
        return CardEffect.addEffectToAllPlayerUnits(effectRule, sourceCard, playerId, gameEnv);
    }

    /**
     * Process link-triggered continuous effects (PHASE 1: Storage only - placeholder)
     */
    private static processLinkTriggeredEffect(
        effectRule: any, 
        sourceCard: any, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        console.log(`🔄 Processing link-triggered effect from ${sourceCard.cardId} (placeholder)`);
        return CardEffect.addEffectToAllPlayerUnits(effectRule, sourceCard, playerId, gameEnv);
    }

    /**
     * Get opponent player ID
     */
    private static getOpponentId(playerId: string, gameEnv: GameEnvironment): string {
        const playerIds = Object.keys(gameEnv.players);
        return playerIds.find(id => id !== playerId) || '';
    }

    /**
     * Clean up effects from a removed card
     */
    static cleanupEffectsFromCard(removedCardUid: string, gameEnv: GameEnvironment): void {
        console.log(`🧹 Cleaning up effects from removed card: ${removedCardUid}`);
        
        const allCards = CardEffect.getAllCards(gameEnv);
        
        for (const card of allCards) {
            if (!card.continuousEffects || card.continuousEffects.length === 0) continue;
            
            const removedCount = ContinuousEffectsHelper.removeEffectsFromSource(card.continuousEffects, removedCardUid);
            
            for (let i = card.continuousEffects.length - 1; i >= 0; i--) {
                const effect = card.continuousEffects[i];
                if (effect.sourceCardUid === removedCardUid && effect.active) {
                    CardEffect.removeEffectValue(card, effect.effect.action, effect.appliedValue);
                }
            }
            
            if (removedCount > 0) {
                console.log(`🗑️ Cleaned up ${removedCount} effects from ${card.cardUid}`);
            }
        }
    }

    /**
     * Get all cards from game environment
     */
    private static getAllCards(gameEnv: GameEnvironment): ZoneCard[] {
        const cards: ZoneCard[] = [];
        
        for (const player of Object.values(gameEnv.players)) {
            if (!player.zones) continue;
            
            const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
            for (const slotKey of slotZones) {
                const slot = player.zones[slotKey];
                if (slot.unit) cards.push(slot.unit);
                if (slot.pilot) cards.push(slot.pilot);
            }
            
            if (player.zones.base) {
                cards.push(...player.zones.base);
            }
            if (player.zones.shieldArea) {
                cards.push(...player.zones.shieldArea);
            }
            if (player.zones.energyArea) {
                cards.push(...player.zones.energyArea);
            }
            if (player.zones.trashArea) {
                cards.push(...player.zones.trashArea);
            }
        }
        
        return cards;
    }

    /**
     * Remove effect value from card
     */
    private static removeEffectValue(card: ZoneCard, action: string, value: number): void {
        CardEffect.applyEffectValue(card, action, -value);
    }

    // Utility methods for cleaner data extraction
    static extractTrigger(rule: any): string {
        return typeof rule.trigger === 'string' ? rule.trigger : rule.trigger?.event || '';
    }

    static extractConditions(rule: any): string[] {
        return rule.conditions || rule.trigger?.conditions || [];
    }

    static extractTargetScope(rule: any): string {
        return rule.target?.scope || rule.target?.owner || 'self';
    }

    static extractEffectId(rule: any): string {
        return rule.effectId || rule.id || 'unknown_effect';
    }
    private gameEnv: GameEnvironment;
    private playerId: string;
    private target: any;
    private effect: any;
    
    constructor(gameEnv: GameEnvironment, playerId: string, target: any, effect: any) {
        this.gameEnv = gameEnv;
        this.playerId = playerId;
        this.target = target;
        this.effect = effect;
    }
    
    /**
     * Main execution method - handles any effect action
     */
    execute(): EffectResult {
        const { action } = this.effect;
        
        console.log(`🎯 CardEffect executing: ${action} for player ${this.playerId}`);
        
        try {
            switch (action) {
                case 'addToHand':
                    return this.executeAddToHand();
                case 'heal':
                    return this.executeHeal();
                default:
                    console.log(`⚠️ Unknown effect action: ${action} - returning success for placeholder`);
                    return {
                        success: true,
                        message: `Effect action ${action} not yet implemented`
                    };
            }
        } catch (error) {
            console.error(`❌ CardEffect execution failed:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Effect execution failed'
            };
        }
    }
    
    /**
     * Handle addToHand effects - universal for any "from" source
     */
    private executeAddToHand(): EffectResult {
        const { parameters } = this.effect;
        const { count = 1, from } = parameters;
        
        console.log(`🃏 Adding ${count} cards to hand from ${from}`);
        
        // Resolve target cards based on target specification  
        const targetCards = this.resolveTargetCards();
        
        // Execute based on "from" parameter
        switch (from) {
            case 'shield':
                return this.addFromShieldToHand(targetCards, count);
            default:
                console.log(`⚠️ Unknown addToHand source: ${from} - returning success for placeholder`);
                return {
                    success: true,
                    message: `AddToHand source ${from} not yet implemented`
                };
        }
    }
    
    /**
     * Handle heal effects - repair abilities
     */
    private executeHeal(): EffectResult {
        const { parameters } = this.effect;
        const { amount = 2 } = parameters;
        
        console.log(`🩹 Executing heal for ${amount} HP on player ${this.playerId}`);
        
        // For repair_2, target is self - find the unit that needs healing
        const targetUnit = this.findTargetUnit();
        if (!targetUnit) {
            return {
                success: false,
                error: 'Target unit not found for healing'
            };
        }
        
        // Get card data to check max HP
        const cardData = this.getCardData(targetUnit.cardId);
        if (!cardData) {
            return {
                success: false,
                error: 'Card data not found for healing'
            };
        }
        
        const maxHP = cardData.hp;
        const currentHP = targetUnit.currentHP || maxHP;
        
        // Calculate actual healing (can't exceed max HP)
        const newHP = Math.min(currentHP + amount, maxHP);
        const actualHealing = newHP - currentHP;
        
        if (actualHealing > 0) {
            // Apply healing
            targetUnit.currentHP = newHP;
            
            console.log(`✅ Healed ${targetUnit.cardId} for ${actualHealing} HP (${currentHP} → ${newHP}/${maxHP})`);
            
            return {
                success: true,
                message: `Healed ${targetUnit.cardId} for ${actualHealing} HP`,
                affectedCards: [targetUnit]
            };
        } else {
            console.log(`ℹ️ ${targetUnit.cardId} already at max HP (${currentHP}/${maxHP}) - no healing applied`);
            
            return {
                success: true,
                message: `${targetUnit.cardId} already at max HP - no healing applied`,
                affectedCards: []
            };
        }
    }
    
    /**
     * Find the target unit for healing (self-targeting repair abilities)
     */
    private findTargetUnit(): any {
        // This method will be called with specific card UID context from StateBasedActionEngine
        // For now, return null - will be enhanced when integrated
        return null;
    }
    
    /**
     * Get card data helper
     */
    private getCardData(cardId: string): any {
        try {
            const GameEngine = require('./GameEngine');
            return GameEngine.GameEngine.getCardDetails(cardId);
        } catch (error) {
            console.error(`❌ Error loading card data for ${cardId}:`, error);
            return null;
        }
    }
    
    // ============ TARGET RESOLUTION METHODS ============
    
    /**
     * Universal target resolution based on target specification
     */
    private resolveTargetCards(): any[] {
        if (!this.target) {
            return [];
        }
        
        const { type, scope, filters } = this.target;
        
        console.log(`🎯 Resolving targets: type=${type}, scope=${scope}`);
        
        switch (scope) {
            case 'self_shield':
                return this.getPlayerShieldCards();
            default:
                console.log(`⚠️ Unknown target scope: ${scope}`);
                return [];
        }
    }
    
    /**
     * Get player's shield area cards
     */
    private getPlayerShieldCards(): any[] {
        const player = this.gameEnv.players[this.playerId];
        if (!player || !player.zones) {
            return [];
        }
        
        const shieldCards = player.zones.shieldArea || [];
        console.log(`🛡️ Found ${shieldCards.length} shield cards`);
        return shieldCards;
    }
    
    /**
     * Add cards from shield area to hand
     */
    private addFromShieldToHand(targetCards: any[], count: number): EffectResult {
        const player = this.gameEnv.players[this.playerId];
        const shieldCards = player.zones.shieldArea || [];
        
        const cardsToMove = shieldCards.slice(0, count);
        const movedCards = [];
        
        for (const card of cardsToMove) {
            // Move from shield to hand
            const index = shieldCards.indexOf(card);
            if (index > -1) {
                // Remove from shield area
                shieldCards.splice(index, 1);
                
                // Add to hand using correct _handUids structure
                player.deck._handUids.push(card.cardUid);
                movedCards.push(card);
            }
        }
        
        console.log(`🛡️➡️🃏 Moved ${movedCards.length} cards from shield to hand`);
        
        return {
            success: true,
            message: `Moved ${movedCards.length} cards from shield to hand`,
            affectedCards: movedCards
        };
    }
    
    // ============ HELPER METHODS ============
    
    /**
     * Get opponent player ID
     */
    private getOpponentId(): string {
        const playerIds = Object.keys(this.gameEnv.players);
        return playerIds.find(id => id !== this.playerId) || '';
    }
}