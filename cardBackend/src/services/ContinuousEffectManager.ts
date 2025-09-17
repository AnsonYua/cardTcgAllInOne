// src/services/ContinuousEffectManager.ts
// Manager for continuous effects system

import { GameEnvironment } from '../models/GameEnvironment';
import { ZoneCard, UnitZoneCard, PilotZoneCard, BaseCard } from '../models/CardSystem';
import { 
    StoredContinuousEffect, 
    ContinuousEffectsCollection, 
    EffectRule, 
    EffectProcessingResult,
    EffectTiming,
    EffectDuration,
    EffectAction,
    EffectScope,
    ContinuousEffectsHelper,
    findEffectByKey,
    getEffectUniqueKey,
    createEmptyContinuousEffectsCollection
} from '../models/ContinuousEffects';

// Enhanced types for generalized continuous effects system
export enum ContinuousEffectType {
    ALWAYS_ACTIVE = 'ALWAYS_ACTIVE',
    PAIR_TRIGGERED = 'PAIR_TRIGGERED', 
    LINK_TRIGGERED = 'LINK_TRIGGERED'
}

export interface SlotState {
    hasUnit: boolean;
    hasPilot: boolean;
    isPaired: boolean;
    isLinked: boolean;
}
import { CardEffect } from './CardEffect';

export class ContinuousEffectManager {
    
    /**
     * Main entry point - process all continuous effects
     */
    public static processSlotCardEffects(gameEnv: GameEnvironment): EffectProcessingResult {
        console.log(`🔄 Processing continuous effects from paired cards`);
        
        try {
            let totalEffects = 0;
            
            for (const [playerId, player] of Object.entries(gameEnv.players)) {
                const playerEffects = this.processPlayerSlots(player, playerId, gameEnv);
                totalEffects += playerEffects;
            }
            
            console.log(`✅ Applied ${totalEffects} continuous effects`);
            return { success: true, effectsProcessed: totalEffects, effectsActivated: totalEffects, effectsDeactivated: 0 };
            
        } catch (error) {
            console.error(`❌ Error processing slot effects:`, error);
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
            const slotState = this.detectSlotState(slot);
            
            // Process effects based on slot state
            effectCount += this.processSlotEffects(slot, slotState, playerId, gameEnv);
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
        const isLinked = isPaired ? this.detectLink(slot.unit, slot.pilot) : false;
        
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
            effectCount += this.processCardEffects(slot.unit, slotState, playerId, gameEnv);
        }
        
        // Process pilot effects
        if (slot.pilot) {
            effectCount += this.processCardEffects(slot.pilot, slotState, playerId, gameEnv);
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
            
            const effectType = this.classifyEffectType(effectRule);
            
            // Use switch case for different effect types
            switch (effectType) {
                case ContinuousEffectType.ALWAYS_ACTIVE:
                    if (this.processAlwaysActiveEffect(effectRule, card, playerId, gameEnv)) {
                        appliedCount++;
                    }
                    break;
                    
                case ContinuousEffectType.PAIR_TRIGGERED:
                    if (slotState.isPaired && this.processPairTriggeredEffect(effectRule, card, playerId, gameEnv)) {
                        appliedCount++;
                    }
                    break;
                    
                case ContinuousEffectType.LINK_TRIGGERED:
                    if (slotState.isLinked && this.processLinkTriggeredEffect(effectRule, card, playerId, gameEnv)) {
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
     * Process always active continuous effects (like ST01-009 "Zowort")
     */
    private static processAlwaysActiveEffect(
        effectRule: any, 
        sourceCard: any, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        console.log(`🔄 Processing always active effect from ${sourceCard.cardId}`);
        
        // Extract scope pattern for target resolution
        const scope = CardEffect.extractTargetScope(effectRule);
        
        // Handle different scope patterns
        switch (scope) {
            case 'self':
            case 'self_all':
                return this.applyEffectToPlayerCards(effectRule, sourceCard, playerId, gameEnv);
                
            case 'opponent':
            case 'opponent_all':
                const opponentId = this.getOpponentId(playerId, gameEnv);
                return this.applyEffectToPlayerCards(effectRule, sourceCard, opponentId, gameEnv);
                
            case 'all':
                // Apply to both players (placeholder for future expansion)
                let applied = false;
                for (const targetPlayerId of Object.keys(gameEnv.players)) {
                    if (this.applyEffectToPlayerCards(effectRule, sourceCard, targetPlayerId, gameEnv)) {
                        applied = true;
                    }
                }
                return applied;
                
            default:
                console.log(`⚠️ Unknown scope pattern: ${scope}`);
                return false;
        }
    }

    /**
     * Process pair-triggered continuous effects
     */
    private static processPairTriggeredEffect(
        effectRule: any, 
        sourceCard: any, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        console.log(`🔄 Processing pair-triggered effect from ${sourceCard.cardId}`);
        
        // Use existing pair effect logic from CardEffect
        return CardEffect.applyEffectToAllPlayerUnits(effectRule, sourceCard, playerId, gameEnv);
    }

    /**
     * Process link-triggered continuous effects (placeholder for future expansion)
     */
    private static processLinkTriggeredEffect(
        effectRule: any, 
        sourceCard: any, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        console.log(`🔄 Processing link-triggered effect from ${sourceCard.cardId} (placeholder)`);
        
        // Placeholder implementation - similar to pair effects but for links
        // Future expansion: implement link-specific logic here
        return CardEffect.applyEffectToAllPlayerUnits(effectRule, sourceCard, playerId, gameEnv);
    }

    /**
     * Apply effect to all cards owned by a player (for always active effects)
     */
    private static applyEffectToPlayerCards(
        effectRule: any, 
        sourceCard: any, 
        targetPlayerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        const targetUnits = CardEffect.getAllPlayerUnits(targetPlayerId, gameEnv);
        const effectId = CardEffect.extractEffectId(effectRule);
        
        for (const unit of targetUnits) {
            CardEffect.addContinuousEffect(unit, effectRule, sourceCard, effectId);
        }
        
        return targetUnits.length > 0;
    }

    /**
     * Get opponent player ID
     */
    private static getOpponentId(playerId: string, gameEnv: GameEnvironment): string {
        const playerIds = Object.keys(gameEnv.players);
        return playerIds.find(id => id !== playerId) || '';
    }

    /**
     * Process pair-triggered continuous effects from a single card
     */
    private static processCardPairEffects(card: ZoneCard, playerId: string, gameEnv: GameEnvironment): number {
        const effects = CardEffect.findPairContinuousEffects(card);
        let appliedCount = 0;
        
        for (const effect of effects) {
            if (CardEffect.applyEffectToAllPlayerUnits(effect, card, playerId, gameEnv)) {
                appliedCount++;
            }
        }
        
        return appliedCount;
    }



    /**
     * Main entry point - process all continuous effects
     */
    public static processAllContinuousEffects(gameEnv: GameEnvironment): EffectProcessingResult {
        console.log(`🔄 ContinuousEffectManager: Processing all continuous effects`);
        
        try {
            // Use the new slot-based processing method
            const result = this.processSlotCardEffects(gameEnv);
            
            if (result.success) {
                console.log(`✅ All continuous effects processed: ${result.effectsProcessed} processed, ${result.effectsActivated} activated, ${result.effectsDeactivated} deactivated`);
            } else {
                console.error(`❌ Error processing continuous effects: ${result.error}`);
            }
            
            return result;
            
        } catch (error) {
            console.error(`❌ Error processing continuous effects:`, error);
            return {
                success: false,
                effectsProcessed: 0,
                effectsActivated: 0,
                effectsDeactivated: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    /**
     * Process effects from a specific source card
     */
    public static processEffectsFromCard(sourceCard: ZoneCard, gameEnv: GameEnvironment): EffectProcessingResult {
        let effectsProcessed = 0;
        let effectsActivated = 0;
        let effectsDeactivated = 0;
        
        if (!sourceCard.cardData?.effects?.rules) {
            return { success: true, effectsProcessed: 0, effectsActivated: 0, effectsDeactivated: 0 };
        }
        
        // TODO: Implement simplified continuous effect processing
        
        return { success: true, effectsProcessed, effectsActivated, effectsDeactivated };
    }
    
    
    /**
     * Update existing effects on a card
     */
    private static updateExistingEffects(targetCard: ZoneCard, gameEnv: GameEnvironment): EffectProcessingResult {
        let effectsActivated = 0;
        let effectsDeactivated = 0;
        
        if (!targetCard.continuousEffects || targetCard.continuousEffects.length === 0) {
            return { success: true, effectsProcessed: 0, effectsActivated: 0, effectsDeactivated: 0 };
        }
        
        // Iterate through effects array (iterate backwards for safe removal)
        for (let i = targetCard.continuousEffects.length - 1; i >= 0; i--) {
            const storedEffect = targetCard.continuousEffects[i];
            
            try {
                // Find source card
                const sourceCard = this.findCardByUid(storedEffect.sourceCardUid, gameEnv);
                if (!sourceCard) {
                    // Source card no longer exists, remove effect
                    this.removeEffectFromCard(targetCard, storedEffect.effectId, storedEffect.sourceCardUid);
                    console.log(`🗑️ Removed orphaned effect ${storedEffect.effectId} from ${targetCard.cardUid}`);
                    continue;
                }
                
                // Check if effect should be active now
                const shouldBeActive = this.validateStoredEffect(storedEffect, sourceCard, targetCard, gameEnv);
                
                if (storedEffect.active !== shouldBeActive) {
                    if (shouldBeActive) {
                        // Activate effect
                        const value = CardEffect.getEffectValue(storedEffect.effect.action, storedEffect.effect.parameters);
                        
                        // Only apply numeric effects
                        if (storedEffect.effect.action === 'modifyAP' || storedEffect.effect.action === 'modifyHP') {
                            CardEffect.applyEffectValue(targetCard, storedEffect.effect.action, value);
                        }
                        
                        storedEffect.active = true;
                        storedEffect.appliedValue = value;
                        effectsActivated++;
                        console.log(`✅ Activated effect ${storedEffect.effectId} (${storedEffect.effect.action}) on ${targetCard.cardUid} (value: ${value})`);
                        
                    } else {
                        // Deactivate effect
                        if (storedEffect.effect.action === 'modifyAP' || storedEffect.effect.action === 'modifyHP') {
                            this.removeEffectValue(targetCard, storedEffect.effect.action, storedEffect.appliedValue);
                        }
                        
                        storedEffect.active = false;
                        storedEffect.appliedValue = 0;
                        effectsDeactivated++;
                        console.log(`❌ Deactivated effect ${storedEffect.effectId} (${storedEffect.effect.action}) on ${targetCard.cardUid}`);
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error updating effect ${storedEffect.effectId} on ${targetCard.cardUid}:`, error);
            }
        }
        
        return { success: true, effectsProcessed: 0, effectsActivated, effectsDeactivated };
    }
    
    /**
     * Clean up effects from a removed card
     */
    public static cleanupEffectsFromCard(removedCardUid: string, gameEnv: GameEnvironment): void {
        console.log(`🧹 Cleaning up effects from removed card: ${removedCardUid}`);
        
        const allCards = this.getAllCards(gameEnv);
        
        for (const card of allCards) {
            if (!card.continuousEffects || card.continuousEffects.length === 0) continue;
            
            // Remove effects from the specified source using helper method
            const removedCount = ContinuousEffectsHelper.removeEffectsFromSource(card.continuousEffects, removedCardUid);
            
            // Also manually remove effect values that were applied
            for (let i = card.continuousEffects.length - 1; i >= 0; i--) {
                const effect = card.continuousEffects[i];
                if (effect.sourceCardUid === removedCardUid && effect.active) {
                    this.removeEffectValue(card, effect.effect.action, effect.appliedValue);
                }
            }
            
            if (removedCount > 0) {
                console.log(`🗑️ Cleaned up ${removedCount} effects from ${card.cardUid}`);
            }
        }
    }
    
    // ============ UTILITY METHODS ============
    
    private static getAllCards(gameEnv: GameEnvironment): ZoneCard[] {
        const cards: ZoneCard[] = [];
        
        for (const player of Object.values(gameEnv.players)) {
            if (!player.zones) continue;
            
            // Slot zones
            const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
            for (const slotKey of slotZones) {
                const slot = player.zones[slotKey];
                if (slot.unit) cards.push(slot.unit);
                if (slot.pilot) cards.push(slot.pilot);
            }
            
            // Other zones
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
    
    private static findCardByUid(cardUid: string, gameEnv: GameEnvironment): ZoneCard | null {
        const allCards = this.getAllCards(gameEnv);
        return allCards.find(card => card.cardUid === cardUid) || null;
    }
    
    private static hasEffectRules(card: ZoneCard): boolean {
        return !!(card.cardData?.effects?.rules && card.cardData.effects.rules.length > 0);
    }
    
    private static isContinuousEffect(effectRule: any): boolean {
        const trigger = typeof effectRule.trigger === 'string' ? effectRule.trigger : effectRule.trigger?.event;
        return trigger === 'continuous';
    }
    
    
    private static getCardOwner(card: ZoneCard, gameEnv: GameEnvironment): string | null {
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player.zones) continue;
            
            // Check slot zones
            const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
            for (const slotKey of slotZones) {
                const slot = player.zones[slotKey];
                if (slot.unit?.cardUid === card.cardUid || slot.pilot?.cardUid === card.cardUid) {
                    return playerId;
                }
            }
            
            // Check other zones
            const otherZones = ['base', 'shieldArea', 'energyArea', 'trashArea'] as const;
            for (const zoneKey of otherZones) {
                const zone = player.zones[zoneKey];
                if (Array.isArray(zone) && zone.some(c => c.cardUid === card.cardUid)) {
                    return playerId;
                }
            }
        }
        return null;
    }
    
    
    
    private static validateStoredEffect(
        storedEffect: StoredContinuousEffect,
        sourceCard: ZoneCard,
        targetCard: ZoneCard,
        gameEnv: GameEnvironment
    ): boolean {
        // Check timing from stored effect
        if (!this.validateTiming(storedEffect.timing, sourceCard, gameEnv)) {
            return false;
        }
        
        // Check duration from stored effect
        if (!this.validateDuration(storedEffect.effect.duration, sourceCard, targetCard, gameEnv)) {
            return false;
        }
        
        return true;
    }
    
    
    private static validateTiming(timing: string[], sourceCard: ZoneCard, gameEnv: GameEnvironment): boolean {
        for (const time of timing) {
            switch (time) {
                case EffectTiming.YOUR_TURN:
                    const owner = this.getCardOwner(sourceCard, gameEnv);
                    if (gameEnv.currentPlayer !== owner) return false;
                    break;
                case EffectTiming.OPPONENT_TURN:
                    const ownerOpp = this.getCardOwner(sourceCard, gameEnv);
                    if (gameEnv.currentPlayer === ownerOpp) return false;
                    break;
                case EffectTiming.ALWAYS:
                    // Always valid
                    break;
            }
        }
        return true;
    }
    
    private static validateDuration(duration: string, sourceCard: ZoneCard, targetCard: ZoneCard, gameEnv: GameEnvironment): boolean {
        switch (duration) {
            case EffectDuration.WHILE_PAIRED:
                return this.isPaired(sourceCard, gameEnv);
            case EffectDuration.PERMANENT:
                return true;
            // Add more duration types as needed
            default:
                return true;
        }
    }
    
    private static isPaired(card: ZoneCard, gameEnv: GameEnvironment): boolean {
        // Find the slot containing this card
        for (const player of Object.values(gameEnv.players)) {
            if (!player.zones) continue;
            
            const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
            for (const slotKey of slotZones) {
                const slot = player.zones[slotKey];
                
                // Check if this card is in the slot and the slot has both unit and pilot
                if ((slot.unit?.cardUid === card.cardUid || slot.pilot?.cardUid === card.cardUid) &&
                    slot.unit && slot.pilot) {
                    return true;
                }
            }
        }
        return false;
    }
    
    
    private static removeEffectValue(card: ZoneCard, action: string, value: number): void {
        CardEffect.applyEffectValue(card, action, -value);
    }
    
    private static removeEffectFromCard(card: ZoneCard, effectId: string, sourceCardUid: string): void {
        if (!card.continuousEffects) return;
        
        const effect = findEffectByKey(card.continuousEffects, effectId, sourceCardUid);
        if (effect && effect.active) {
            this.removeEffectValue(card, effect.effect.action, effect.appliedValue);
        }
        
        // Remove using helper method
        ContinuousEffectsHelper.removeEffect(card.continuousEffects, effectId, sourceCardUid);
    }
}