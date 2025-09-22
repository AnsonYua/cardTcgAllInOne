// src/services/PairingEffect.ts
// Pairing effect management - handles PAIRING_COMPLETE triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { TargetChoiceManager } from './TargetChoiceManager';

export interface PairingEffectResult {
    success: boolean;
    error?: string;
    message?: string;
    effectsProcessed?: number;
}

export class PairingEffect {
    
    /**
     * Check if a pairing has triggered effects (PAIRING_COMPLETE triggers)
     */
    static checkForPairingEffects(eventData: any, placementResult: any, gameEnv: GameEnvironment): any[] {
        console.log("PairingEffect.checkForPairingEffects - pairing detected, checking for triggered effects");
        
        const pairingEffects: any[] = [];
        const player = gameEnv.getPlayer(eventData.playerId);
        if (!player || !player.zones) {
            console.log(`⚠️ Player ${eventData.playerId} or zones not found for pairing effect check`);
            return pairingEffects;
        }

        // Find the slot where the pairing occurred
        const { slot: pairedSlot, unit: pairedUnit } = this.findSlotByCardUid(player, eventData.cardUID);
        if (!pairedSlot || !pairedUnit) {
            console.log(`⚠️ Could not find paired slot for card ${eventData.cardUID}`);
            return pairingEffects;
        }

        const slotZone = (player.zones as any)[pairedSlot];
        const pilot = slotZone?.pilot;
        
        if (!pilot) {
            console.log(`⚠️ No pilot found in paired slot ${pairedSlot}`);
            return pairingEffects;
        }

        console.log(`🤝 Checking pairing effects for Unit: ${pairedUnit.cardId}, Pilot: ${pilot.cardId}`);

        // Check both unit and pilot for pairing effects
        const cardsToCheck = [
            { cardUID: pairedUnit.cardUid, cardId: pairedUnit.cardId, cardData: pairedUnit.cardData, cardType: 'unit' },
            { cardUID: pilot.cardUid, cardId: pilot.cardId, cardData: pilot.cardData, cardType: 'pilot' }
        ];

        for (const cardInfo of cardsToCheck) {
            if (!cardInfo.cardData?.effects?.rules) continue;

            const cardPairingEffects = cardInfo.cardData.effects.rules.filter((rule: any) => 
                rule.type === 'triggered' && rule.trigger === 'PAIRING_COMPLETE'
            );

            for (const effect of cardPairingEffects) {
                // Validate conditions (e.g., trait matching)
                if (this.validatePairingConditions(effect.conditions || [], pairedUnit, pilot, gameEnv)) {
                    pairingEffects.push({
                        ...effect,
                        sourceCard: cardInfo,
                        unitCard: { cardUID: pairedUnit.cardUid, cardId: pairedUnit.cardId, cardData: pairedUnit.cardData },
                        pilotCard: { cardUID: pilot.cardUid, cardId: pilot.cardId, cardData: pilot.cardData },
                        pairedSlot: pairedSlot
                    });
                    console.log(`🔗 Found pairing effect: ${effect.effectId} from ${cardInfo.cardType} ${cardInfo.cardId}`);
                }
            }
        }

        console.log(`🔍 Pairing effect check complete: found ${pairingEffects.length} effects`);
        return pairingEffects;
    }

    /**
     * Process pairing effects - main processing entry point
     */
    static processPairingEffect(gameEnv: GameEnvironment, eventData: any): PairingEffectResult {
        console.log(`🤝 PairingEffect.processPairingEffect - processing pairing effects`);
        
        try {
            const { playerId, effects } = eventData;
            
            if (!effects || effects.length === 0) {
                console.log(`⚠️ No pairing effects to process`);
                return { 
                    success: true, 
                    message: 'No pairing effects to process',
                    effectsProcessed: 0 
                };
            }
            
            console.log(`🔗 Processing ${effects.length} pairing effect(s) for player ${playerId}`);
            let effectsProcessed = 0;
            
            // Process each pairing effect (no tracking needed - re-pairing is impossible)
            for (const effect of effects) {
                const { effectId } = effect;
                
                console.log(`⚡ Executing pairing effect: ${effectId}`);
                
                // Execute the effect based on its action
                const executionResult = this.executePairingEffectAction(gameEnv, playerId, effect);
                
                if (!executionResult.success) {
                    console.error(`❌ Failed to execute pairing effect ${effectId}: ${executionResult.error}`);
                    continue;
                }
                
                console.log(`✅ Pairing effect ${effectId} executed successfully`);
                effectsProcessed++;
            }
            
            console.log(`✅ Pairing effects processing complete: ${effectsProcessed} effects processed`);
            return { 
                success: true, 
                message: `Successfully processed ${effectsProcessed} pairing effects`,
                effectsProcessed 
            };
            
        } catch (error) {
            console.error(`❌ Error in PairingEffect.processPairingEffect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing effect processing failed'
            };
        }
    }

    /**
     * Validate pairing effect conditions (trait matching, etc.)
     */
    private static validatePairingConditions(conditions: any[], unit: any, pilot: any, gameEnv: GameEnvironment): boolean {
        if (!conditions || conditions.length === 0) {
            return true; // No conditions means effect always triggers
        }

        for (const condition of conditions) {
            if (!this.validateSinglePairingCondition(condition, unit, pilot, gameEnv)) {
                return false; // All conditions must pass
            }
        }

        return true;
    }

    /**
     * Validate a single pairing condition
     */
    private static validateSinglePairingCondition(condition: any, unit: any, pilot: any, gameEnv: GameEnvironment): boolean {
        console.log(`🔍 Validating condition:`, JSON.stringify(condition));

        switch (condition.type) {
            case 'traitMatch':
                return this.validateTraitMatch(condition, unit, pilot);
            case 'cardTypeMatch':
                return this.validateCardTypeMatch(condition, unit, pilot);
            case 'powerThreshold':
                return this.validatePowerThreshold(condition, unit, pilot);
            default:
                console.log(`⚠️ Unknown condition type: ${condition.type}`);
                return false;
        }
    }

    /**
     * Validate trait matching condition
     */
    private static validateTraitMatch(condition: any, unit: any, pilot: any): boolean {
        const { target, traits } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'any':
                // Check if either card has the required traits
                return this.hasRequiredTraits(unit, traits) || this.hasRequiredTraits(pilot, traits);
            default:
                console.log(`⚠️ Unknown trait match target: ${target}`);
                return false;
        }

        return this.hasRequiredTraits(targetCard, traits);
    }

    /**
     * Check if a card has the required traits
     */
    private static hasRequiredTraits(card: any, requiredTraits: string[]): boolean {
        if (!card?.cardData?.traits || !Array.isArray(card.cardData.traits)) {
            console.log(`⚠️ Card ${card?.cardId} has no traits array`);
            return false;
        }

        const cardTraits = card.cardData.traits;
        console.log(`🏷️ Card ${card.cardId} traits:`, cardTraits, `Required:`, requiredTraits);

        // Check if card has all required traits
        const hasAllTraits = requiredTraits.every(requiredTrait => 
            cardTraits.some((cardTrait: string) => cardTrait === requiredTrait)
        );

        console.log(`✅ Trait match result for ${card.cardId}:`, hasAllTraits);
        return hasAllTraits;
    }

    /**
     * Validate card type matching condition
     */
    private static validateCardTypeMatch(condition: any, unit: any, pilot: any): boolean {
        const { target, cardTypes } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'any':
                return this.hasRequiredCardType(unit, cardTypes) || this.hasRequiredCardType(pilot, cardTypes);
            default:
                console.log(`⚠️ Unknown card type match target: ${target}`);
                return false;
        }

        return this.hasRequiredCardType(targetCard, cardTypes);
    }

    /**
     * Check if a card has the required card type
     */
    private static hasRequiredCardType(card: any, requiredTypes: string[]): boolean {
        if (!card?.cardData?.cardType) {
            return false;
        }

        const cardType = card.cardData.cardType;
        return requiredTypes.includes(cardType);
    }

    /**
     * Validate power threshold condition
     */
    private static validatePowerThreshold(condition: any, unit: any, pilot: any): boolean {
        const { target, operator, value } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'combined':
                const unitPower = this.getCardPower(unit);
                const pilotPower = this.getCardPower(pilot);
                const combinedPower = unitPower + pilotPower;
                return this.compareValues(combinedPower, operator, value);
            default:
                console.log(`⚠️ Unknown power threshold target: ${target}`);
                return false;
        }

        const cardPower = this.getCardPower(targetCard);
        return this.compareValues(cardPower, operator, value);
    }

    /**
     * Get card's current power
     */
    private static getCardPower(card: any): number {
        return card?.currentAP || card?.cardData?.ap || 0;
    }

    /**
     * Compare values using operator
     */
    private static compareValues(actual: number, operator: string, expected: number): boolean {
        switch (operator) {
            case '>=':
                return actual >= expected;
            case '>':
                return actual > expected;
            case '<=':
                return actual <= expected;
            case '<':
                return actual < expected;
            case '===':
                return actual === expected;
            default:
                console.log(`⚠️ Unknown comparison operator: ${operator}`);
                return false;
        }
    }

    /**
     * Execute specific pairing effect action (draw, heal, etc.)
     */
    private static executePairingEffectAction(gameEnv: GameEnvironment, playerId: string, effect: any): { success: boolean; error?: string } {
        const { effect: effectDef, target } = effect;
        const { action, parameters } = effectDef;
        
        console.log(`🎯 Executing pairing action: ${action} with parameters:`, parameters);
        
        try {
            switch (action) {
                case 'draw':
                    return this.executePairingDrawEffect(gameEnv, playerId, parameters, target);
                case 'heal':
                    return this.executePairingHealEffect(gameEnv, playerId, parameters, target, effect);
                case 'modifyAP':
                    return this.executePairingModifyAPEffect(gameEnv, playerId, parameters, target, effect);
                case 'modifyHP':
                    return this.executePairingModifyHPEffect(gameEnv, playerId, parameters, target, effect);
                default:
                    console.log(`⚠️ Unknown pairing effect action: ${action}`);
                    return {
                        success: false,
                        error: `Unknown pairing effect action: ${action}`
                    };
            }
        } catch (error) {
            console.error(`❌ Error executing pairing action ${action}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : `Failed to execute ${action}`
            };
        }
    }

    /**
     * Execute draw effect from pairing
     */
    private static executePairingDrawEffect(gameEnv: GameEnvironment, playerId: string, parameters: any, target: any): { success: boolean; error?: string } {
        const drawCount = parameters.value || 1;
        const targetPlayerId = target.scope === 'self' ? playerId : gameEnv.getOpponentId(playerId);
        
        if (!targetPlayerId) {
            return {
                success: false,
                error: 'Could not determine target player for draw effect'
            };
        }
        
        const player = gameEnv.getPlayer(targetPlayerId);
        if (!player || !player.deck) {
            return {
                success: false,
                error: `Target player ${targetPlayerId} or deck not found`
            };
        }
        
        // Draw cards using GameEngine method
        this.drawCards(player.deck, drawCount);
        
        console.log(`🃏 Drew ${drawCount} card(s) for player ${targetPlayerId} via pairing effect`);
    
        
        return { success: true };
    }

    /**
     * Execute heal effect from pairing
     */
    private static executePairingHealEffect(gameEnv: GameEnvironment, playerId: string, parameters: any, target: any, effect: any): { success: boolean; error?: string } {
        const healAmount = parameters.value || 0;
        console.log(`🩹 Executing pairing heal effect: ${healAmount} HP`);
        
        // Use existing CardEffect system for healing
        const { CardEffect } = require('./CardEffect');
        const healData = {
            cardId: effect.unitCard.cardId,
            playerId: playerId,
            healAmount: healAmount,
            effectId: effect.effectId,
            triggeredByPairing: true
        };
        
        const result = CardEffect.executeRepairEffect(gameEnv, healData);
        
        if (!result.success) {
            console.log(`❌ Pairing heal effect failed: ${result.error}`);
            return result;
        }
        
        console.log(`✅ Pairing heal effect executed: ${result.message}`);
        return result;
    }

    /**
     * Execute AP modification effect from pairing using unified TARGET_CHOICE system
     * Now supports player choice for strategic target selection (e.g., ST01-006)
     */
    private static executePairingModifyAPEffect(gameEnv: GameEnvironment, playerId: string, parameters: any, target: any, effect: any): { success: boolean; error?: string } {
        const modifyAmount = parameters.value || 0;
        console.log(`⚔️ Executing pairing AP modification: ${modifyAmount > 0 ? '+' : ''}${modifyAmount} AP on ${target.scope} targets`);
        
        try {
            // Create effect definition directly - no factory overhead
            const effectDefinition = {
                effectId: `pairing_ap_modification_${effect.unitCard.cardId}`,
                action: 'modifyAP',
                parameters: parameters
            };
            
            // Create target config directly from target object
            const targetConfig = {
                type: target.type || 'unit',
                scope: target.scope || 'self',
                count: target.count || 1,
                filters: target.filters || {}
            };
            
            // Use unified TargetChoiceManager directly
            const result = TargetChoiceManager.processEffectWithTargetChoice(
                gameEnv,
                playerId,
                'PAIRING',
                effect.unitCard.cardUID,
                effect.unitCard.cardId,
                effectDefinition,
                targetConfig,
                effect.pairedSlot  // Source slot for pairing effects
            );
            
            // Return result directly - no unnecessary conversions
            return {
                success: result.success,
                error: result.error
            };
            
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing AP modification failed'
            };
        }
    }
    
    /**
     * Find eligible targets based on target filters
     */
    private static findEligibleTargets(player: any, target: any): any[] {
        const SLOT_ZONES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
        const eligibleTargets: any[] = [];
        
        for (const slotName of SLOT_ZONES) {
            const slot = player.zones[slotName];
            if (slot?.unit && target.type === 'unit') {
                const unit = slot.unit;
                
                // Apply filters
                if (this.matchesFilters(unit, target.filters || {})) {
                    eligibleTargets.push(unit);
                }
            }
        }
        
        console.log(`🎯 Found ${eligibleTargets.length} eligible targets for effect`);
        return eligibleTargets;
    }
    
    /**
     * Check if a unit matches the target filters
     */
    private static matchesFilters(unit: any, filters: any): boolean {
        // Level filter
        if (filters.level) {
            const unitLevel = unit.cardData?.level || 0;
            if (!this.compareValues(unitLevel, filters.level.includes('<=') ? '<=' : '>=', 
                                  parseInt(filters.level.replace(/[^\d]/g, '')) || 0)) {
                return false;
            }
        }
        
        // Add more filter types as needed (hp, traits, etc.)
        
        return true;
    }

    /**
     * Execute HP modification effect from pairing
     */
    private static executePairingModifyHPEffect(gameEnv: GameEnvironment, playerId: string, parameters: any, target: any, effect: any): { success: boolean; error?: string } {
        const modifyAmount = parameters.value || 0;
        console.log(`❤️ Executing pairing HP modification: ${modifyAmount > 0 ? '+' : ''}${modifyAmount} HP`);
        
        // Find the paired unit to modify
        const player = gameEnv.getPlayer(playerId);
        if (!player) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }
        
        const { slot: pairedSlot, unit: pairedUnit } = this.findSlotByCardUid(player, effect.unitCard.cardUID);
        if (!pairedSlot || !pairedUnit) {
            return {
                success: false,
                error: `Could not find paired unit for HP modification`
            };
        }
        
        // Apply HP modification
        pairedUnit.currentHP = Math.max(0, (pairedUnit.currentHP || pairedUnit.cardData?.hp || 0) + modifyAmount);
        
        console.log(`✅ Modified ${effect.unitCard.cardId} HP by ${modifyAmount}, new HP: ${pairedUnit.currentHP}`);
        return { success: true };
    }

    /**
     * Helper method for drawing cards (similar to GameEngine implementation)
     */
    private static drawCards(deck: any, count: number): void {
        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (drawnCard) {
                deck._handUids.push(drawnCard);
            }
        }
        console.log(`🃏 Drew ${count} cards, hand size: ${deck._handUids.length}`);
    }

    /**
     * Find slot by card UID (copied from GameEngine to remove dependency)
     */
    private static findSlotByCardUid(player: any, cardUID: string): { slot: string | null; unit: any | null } {
        const SLOT_ZONES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
        
        for (const slotName of SLOT_ZONES) {
            const slot = player.zones[slotName];
            if (slot?.unit?.cardUid === cardUID) {
                return { slot: slotName, unit: slot.unit };
            }
            if (slot?.pilot?.cardUid === cardUID) {
                return { slot: slotName, unit: slot.unit }; // Return unit even if pilot was matched
            }
        }
        
        return { slot: null, unit: null };
    }

    /**
     * Get notification manager (copied from GameEngine to remove dependency)
     */
    private static getNotificationManager(gameEnv: GameEnvironment): any {
        // Import dynamically to avoid circular dependencies
        const { GameNotificationManager } = require('./GameNotificationManager');
        return new GameNotificationManager(gameEnv);
    }
}