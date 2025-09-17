// src/services/CardEffect.ts
// Universal card effect processor for all effect types

import { GameEnvironment } from '../models/GameEnvironment';
import { HandCard } from '../models/Player';
import { ZoneCard } from '../models/CardSystem';
import { StoredContinuousEffect, ContinuousEffectsHelper, createEmptyContinuousEffectsCollection } from '../models/ContinuousEffects';

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
     * Apply effect to all units owned by the player
     */
    static applyEffectToAllPlayerUnits(
        effectRule: any, 
        sourceCard: ZoneCard, 
        playerId: string, 
        gameEnv: GameEnvironment
    ): boolean {
        const scope = CardEffect.extractTargetScope(effectRule);
        if (scope !== 'self_all') return false;
        
        const targetUnits = CardEffect.getAllPlayerUnits(playerId, gameEnv);
        const effectId = CardEffect.extractEffectId(effectRule);
        
        for (const unit of targetUnits) {
            CardEffect.addContinuousEffect(unit, effectRule, sourceCard, effectId);
        }
        
        return targetUnits.length > 0;
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
     * Add continuous effect to a target card with duplicate prevention
     */
    static addContinuousEffect(
        targetCard: ZoneCard, 
        effectRule: any, 
        sourceCard: ZoneCard, 
        effectId: string
    ): void {
        // Initialize array if it doesn't exist
        if (!targetCard.continuousEffects) {
            targetCard.continuousEffects = createEmptyContinuousEffectsCollection();
        }
        
        // Extract parameters based on actual structure from st01card.json
        const effectAction = effectRule.effect?.action || 'modifyAP';
        const parameters = effectRule.effect?.parameters || {};
        
        // Calculate value based on action type and actual parameters
        let value = 0;
        if (effectAction === 'modifyAP' && parameters.modifier) {
            value = CardEffect.parseModifier(parameters.modifier);
        } else if (effectAction === 'heal' && parameters.amount) {
            value = parameters.amount;
        } else if (effectAction === 'damage' && parameters.amount) {
            value = parameters.amount;
        } else if (effectAction === 'restrict_attack') {
            // Restriction effects don't have numeric values
            value = 0;
        }
        
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
            active: true,
            appliedValue: value
        };
        
        // Add effect with duplicate prevention
        const wasAdded = ContinuousEffectsHelper.addEffect(targetCard.continuousEffects, storedEffect);
        
        if (wasAdded) {
            // Apply effect immediately only if it was actually added (not a duplicate)
            if (effectAction === 'modifyAP' || effectAction === 'modifyHP') {
                CardEffect.applyEffectValue(targetCard, effectAction, value);
            }
            console.log(`✅ Applied and stored continuous effect: ${effectId} (${effectAction}) from ${sourceCard.cardUid} to ${targetCard.cardUid}`);
        } else {
            console.log(`⚠️ Skipped duplicate continuous effect: ${effectId} from ${sourceCard.cardUid} to ${targetCard.cardUid}`);
        }
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
     * Extract effect parameters safely based on action type
     */
    static extractEffectParameters(effectRule: any): any {
        const action = effectRule.effect?.action;
        const parameters = effectRule.effect?.parameters || {};
        
        // Return parameters as-is from the actual card data structure
        return parameters;
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