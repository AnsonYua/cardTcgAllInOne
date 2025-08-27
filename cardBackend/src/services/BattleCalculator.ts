// =======================================================================================
// 🎯 BATTLE CALCULATOR - TypeScript Implementation with Proper Power Calculation
// =======================================================================================
//
// ARCHITECTURAL PRINCIPLE: Apply fieldEffects.activeEffects to calculate actual powers
// 
// This TypeScript implementation:
// - Applies activeEffects (powerBoost, setPower) to calculate actual card powers
// - Implements combo calculation logic based on card types and traits
// - Uses proper TypeScript types for better maintainability
// - Follows fieldEffects design with proper effect application
//
// PROPER APPROACH:
// 1. Get cards from zones and their base powers
// 2. Apply activeEffects (powerBoost, setPower) to calculate final powers
// 3. Calculate combo bonuses based on card types/traits
// 4. Apply victory point modifiers from fieldEffects
// 5. Return total - comprehensive and accurate!
//
// =======================================================================================

import { GameEnvironment, Player, FieldEffect, PlayerZones } from '../models/GameEnvironment';

interface CardPowerData {
    cardUid: string;
    cardId: string;
    basePower: number;
    finalPower: number;
    zone: string;
    gameType: string;
    traits: string[];
}

interface ComboRule {
    type: string;
    conditions: any;
    bonus: number;
}

// Enhanced Effect Processing Interfaces
enum EffectType {
    // Power Override (Highest Priority)
    SET_POWER = 'setPower',
    POWER_NULLIFICATION = 'POWER_NULLIFICATION',
    
    // Power Modification (Medium Priority)  
    POWER_BOOST = 'powerBoost',
    POWER_REDUCTION = 'powerReduction',
    POWER_MULTIPLY = 'powerMultiply',
    
    // Conditional Effects (Low Priority)
    CONDITIONAL_BOOST = 'conditionalBoost',
    ZONE_SPECIFIC_BOOST = 'zoneSpecificBoost'
}

interface EffectTypeGroups {
    setPower: FieldEffect[];
    powerBoost: FieldEffect[];
    powerReduction: FieldEffect[];
    powerMultiply: FieldEffect[];
    conditional: FieldEffect[];
}

interface AdvancedTargeting {
    scope: 'SELF' | 'OPPONENT' | 'ALL';
    zones?: string[] | 'ALL';
    gameTypes?: string[];
    traits?: string[];
    cardIds?: string[];
    powerRange?: {min?: number, max?: number};
    zonePosition?: 'first' | 'last' | 'any';
    requiresSelection?: boolean;
    maxTargets?: number;
}

export class BattleCalculator {
    private characterCardsData: any = null;

    constructor(private mozGamePlay?: any) {
        // Load character cards data for combo calculation
        this.loadCharacterCardsData();
    }

    /**
     * 🎯 MAIN POWER CALCULATION - Apply activeEffects to calculate actual powers
     * 
     * ARCHITECTURAL PRINCIPLE: Read zones, apply activeEffects, calculate combos
     * This is the CORRECT approach that applies effects to get actual card powers
     */
    async calculatePlayerPoints(gameEnv: GameEnvironment, playerId: string): Promise<number> {
        console.log(`🎯 BattleCalculator: Starting PROPER power calculation for player: ${playerId}`);
        
        // Get player and fieldEffects
        const player = gameEnv.players[playerId];
        if (!player) {
            console.warn(`❌ Player ${playerId} not found`);
            return 0;
        }
        
        const fieldEffects = player.fieldEffects;
        if (!fieldEffects) {
            console.warn(`❌ FieldEffects not found for player ${playerId}`);
            return 0;
        }
        
        // STEP 1: Get all character cards from zones and calculate their powers with effects
        const characterPowers = this.calculateCharacterPowersWithEffects(gameEnv, playerId);
        
        let totalCharacterPower = 0;
        for (const cardData of characterPowers) {
            totalCharacterPower += cardData.finalPower;
            console.log(`  ✅ Card ${cardData.cardUid} (${cardData.cardId}): ${cardData.basePower} → ${cardData.finalPower} power`);
        }
        
        console.log(`📊 Total character power: ${totalCharacterPower}`);
        
        // STEP 2: Calculate combo bonuses
        let comboPoints = 0;
        try {
            comboPoints = this.calculateComboBonuses(characterPowers, playerId);
            
            // Ensure comboPoints is valid
            if (typeof comboPoints !== 'number' || isNaN(comboPoints)) {
                console.warn(`🎲 Invalid combo points (${comboPoints}), setting to 0`);
                comboPoints = 0;
            }
        } catch (error) {
            console.error(`❌ Error calculating combo points:`, error);
            comboPoints = 0;
        }
        
        console.log(`🎲 Combo points: ${comboPoints}`);
        
        // STEP 3: Apply victory point modifiers from fieldEffects
        const victoryPointModifiers = fieldEffects.victoryPointModifiers || 0;
        console.log(`⚡ Victory point modifiers: ${victoryPointModifiers}`);
        
        // STEP 4: Calculate final total
        const finalTotal = Math.max(0, totalCharacterPower + comboPoints + victoryPointModifiers);
        
        console.log(`🎯 BattleCalculator PROPER calculation complete:`);
        console.log(`  📊 Character power: ${totalCharacterPower}`);
        console.log(`  🎲 Combo points: ${comboPoints}`);
        console.log(`  ⚡ VP modifiers: ${victoryPointModifiers}`);
        console.log(`  🏆 FINAL TOTAL: ${finalTotal}`);
        
        return finalTotal;
    }

    /**
     * 📊 CALCULATE CHARACTER POWERS WITH EFFECTS
     * Apply activeEffects to get actual card powers (not just base powers)
     */
    private calculateCharacterPowersWithEffects(gameEnv: GameEnvironment, playerId: string): CardPowerData[] {
        console.log(`📊 Calculating character powers with active effects applied`);
        
        const characterPowers: CardPowerData[] = [];
        const playerZones = gameEnv.zones.getPlayerZones(playerId);
        const fieldEffects = gameEnv.players[playerId].fieldEffects;
        
        if (!playerZones || !fieldEffects) {
            console.warn(`❌ Missing playerZones or fieldEffects for ${playerId}`);
            return characterPowers;
        }
        
        // Process character zones (top, left, right)
        const characterZones: ('top' | 'left' | 'right')[] = ['top', 'left', 'right'];
        
        for (const zone of characterZones) {
            const zoneCards = playerZones[zone];
            if (!zoneCards || !Array.isArray(zoneCards) || zoneCards.length === 0) {
                continue;
            }
            
            for (const zoneCard of zoneCards) {
                const cardData = this.extractCardDataFromZone(zoneCard);
                if (!cardData) continue;
                
                // All cards contribute to power calculation
                
                // ENHANCED: Use comprehensive effect processing pipeline
                const finalPower = this.processCardPowerWithEffectPipeline(
                    cardData, 
                    fieldEffects.activeEffects || [], 
                    zone
                );
                
                // 🎯 NEW: Update zone card with currentPower directly
                this.updateZoneCardCurrentPower(zoneCard, finalPower);
                
                characterPowers.push({
                    cardUid: cardData.cardUid,
                    cardId: cardData.cardId,
                    basePower: cardData.basePower,
                    finalPower: finalPower,
                    zone: zone,
                    gameType: cardData.gameType,
                    traits: cardData.traits
                });
                
                console.log(`    🔧 Applied effects to ${cardData.cardId}: ${cardData.basePower} → ${finalPower}`);
            }
        }
        
        return characterPowers;
    }

    /**
     * 🎯 ENHANCED EFFECT PROCESSING PIPELINE
     * Comprehensive effect handling with proper priority and targeting
     */
    private processCardPowerWithEffectPipeline(
        cardData: any, 
        activeEffects: FieldEffect[], 
        zone: string
    ): number {
        console.log(`    🔍 Processing effects for ${cardData.cardId} in ${zone}`);
        
        // STAGE 1: Discover applicable effects
        const applicableEffects = this.discoverApplicableEffects(cardData, activeEffects, zone);
        console.log(`      📋 Found ${applicableEffects.length} applicable effects`);
        
        // STAGE 2: Categorize effects by type and priority
        const effectGroups = this.categorizeEffectsByType(applicableEffects);
        
        // STAGE 3: Apply effects in priority order
        let currentPower = cardData.basePower;
        
        // Priority 1: SET_POWER effects (override base power)
        if (effectGroups.setPower.length > 0) {
            const latestSetPower = effectGroups.setPower[effectGroups.setPower.length - 1];
            currentPower = Number(latestSetPower.value) || 0;
            console.log(`      🚫 SET_POWER applied: ${latestSetPower.value} from ${latestSetPower.source}`);
        }
        
        // Priority 2: POWER_BOOST effects (additive)
        for (const boostEffect of effectGroups.powerBoost) {
            currentPower += Number(boostEffect.value) || 0;
            console.log(`      ⚡ POWER_BOOST applied: +${boostEffect.value} from ${boostEffect.source}`);
        }
        
        // Priority 3: POWER_REDUCTION effects (subtractive)
        for (const reductionEffect of effectGroups.powerReduction) {
            currentPower -= Number(reductionEffect.value) || 0;
            console.log(`      ⬇️ POWER_REDUCTION applied: -${reductionEffect.value} from ${reductionEffect.source}`);
        }
        
        // Priority 4: POWER_MULTIPLY effects (multiplicative)
        for (const multiplyEffect of effectGroups.powerMultiply) {
            currentPower *= Number(multiplyEffect.value) || 1;
            console.log(`      ✖️ POWER_MULTIPLY applied: ×${multiplyEffect.value} from ${multiplyEffect.source}`);
        }
        
        // Ensure power is never negative
        return Math.max(0, currentPower);
    }

    /**
     * 🔍 DISCOVER APPLICABLE EFFECTS
     * Advanced targeting logic to find effects that apply to this card
     */
    private discoverApplicableEffects(
        cardData: any, 
        activeEffects: FieldEffect[], 
        zone: string
    ): FieldEffect[] {
        const applicableEffects: FieldEffect[] = [];
        
        for (const effect of activeEffects) {
            if (this.isEffectApplicableToCard(effect, cardData, zone)) {
                applicableEffects.push(effect);
            }
        }
        
        return applicableEffects;
    }

    /**
     * 🎯 ADVANCED TARGETING LOGIC
     * Comprehensive effect targeting with multiple criteria
     */
    private isEffectApplicableToCard(effect: FieldEffect, cardData: any, zone: string): boolean {
        const target = effect.target;
        
        // ⭐ NEW: Handle SPECIFIC targeting with cardIds (for card selection effects)
        if (target.scope === 'SPECIFIC' && target.cardIds) {
            // Check if this specific card is targeted by ID or UID
            const isTargeted = target.cardIds.some(targetCardId => 
                targetCardId === cardData.cardId || targetCardId === cardData.cardUid
            );
            if (!isTargeted) {
                return false;
            }
            // If card is specifically targeted, return true (skip other filters)
            console.log(`    🎯 Effect targets specific card: ${cardData.cardId}/${cardData.cardUid}`);
            return true;
        }
        
        // Check zone targeting (convert string zone to match FieldEffect zones)
        if (target.zones && target.zones !== 'ALL') {
            const zoneArray = Array.isArray(target.zones) ? target.zones : [];
            const zoneMatches = zoneArray.some(targetZone => 
                targetZone.toLowerCase() === zone.toLowerCase()
            );
            if (!zoneMatches) {
                return false;
            }
        }
        
        // Check gameType targeting
        if (target.gameTypes && target.gameTypes.length > 0) {
            if (!target.gameTypes.includes(cardData.gameType)) {
                return false;
            }
        }
        
        // Check traits targeting
        if (target.traits && target.traits.length > 0) {
            const hasMatchingTrait = target.traits.some(trait => 
                cardData.traits && cardData.traits.includes(trait)
            );
            if (!hasMatchingTrait) {
                return false;
            }
        }
        
        // Check nameContains targeting (for effects like musk_doge_boost)
        if (target.nameContains && target.nameContains.length > 0) {
            const hasMatchingName = target.nameContains.some(nameFilter => 
                cardData.name && cardData.name.includes(nameFilter)
            );
            if (!hasMatchingName) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 📊 CATEGORIZE EFFECTS BY TYPE
     * Group effects for priority-based processing
     */
    private categorizeEffectsByType(effects: FieldEffect[]): EffectTypeGroups {
        const groups: EffectTypeGroups = {
            setPower: [],
            powerBoost: [],
            powerReduction: [],
            powerMultiply: [],
            conditional: []
        };
        
        for (const effect of effects) {
            switch (effect.type) {
                case 'setPower':
                case 'POWER_NULLIFICATION':
                    groups.setPower.push(effect);
                    break;
                case 'powerBoost':
                    groups.powerBoost.push(effect);
                    break;
                case 'powerReduction':
                    groups.powerReduction.push(effect);
                    break;
                case 'powerMultiply':
                    groups.powerMultiply.push(effect);
                    break;
                default:
                    groups.conditional.push(effect);
            }
        }
        
        return groups;
    }

    /**
     * 🎲 CALCULATE COMBO BONUSES
     * Implement actual combo calculation logic
     */
    private calculateComboBonuses(characterPowers: CardPowerData[], playerId: string): number {
        console.log(`🎲 Calculating combo bonuses for ${characterPowers.length} characters`);
        
        if (characterPowers.length === 0) {
            return 0;
        }
        
        let totalComboPoints = 0;
        
        // Get game types and traits of all characters
        const gameTypes = characterPowers.map(card => card.gameType).filter(Boolean);
        const allTraits = characterPowers.flatMap(card => card.traits || []);
        
        console.log(`  📋 Game types: [${gameTypes.join(', ')}]`);
        console.log(`  📋 All traits: [${allTraits.join(', ')}]`);
        
        // Combo 1: All same type (+250 points)
        const gameTypeCounts = this.countOccurrences(gameTypes);
        for (const [gameType, count] of Object.entries(gameTypeCounts)) {
            if (count >= 3) {
                totalComboPoints += 250;
                console.log(`  🎯 All same type combo (${gameType}): +250 points`);
            }
        }
        
        // Combo 2: Two same type (+50 points)
        for (const [gameType, count] of Object.entries(gameTypeCounts)) {
            if (count === 2) {
                totalComboPoints += 50;
                console.log(`  🎯 Two same type combo (${gameType}): +50 points`);
            }
        }
        
        // Combo 3: Freedom + Economy (+170 points)
        if (gameTypes.includes('自由') && gameTypes.includes('經濟')) {
            totalComboPoints += 170;
            console.log(`  🎯 Freedom + Economy combo: +170 points`);
        }
        
        // Combo 4: Right-wing + Patriot (+150 points)
        if (gameTypes.includes('右翼') && gameTypes.includes('愛國者')) {
            totalComboPoints += 150;
            console.log(`  🎯 Right-wing + Patriot combo: +150 points`);
        }
        
        // Combo 5: Left-wing + Economy (+120 points)
        if (gameTypes.includes('左翼') && gameTypes.includes('經濟')) {
            totalComboPoints += 120;
            console.log(`  🎯 Left-wing + Economy combo: +120 points`);
        }
        
        console.log(`🎲 Total combo points: ${totalComboPoints}`);
        return totalComboPoints;
    }

    /**
     * 🔧 EXTRACT CARD DATA FROM ZONE
     * Extract card information from zone card object
     */
    private extractCardDataFromZone(zoneCard: any): any {
        // Handle new unified structure
        if (zoneCard.cardUid && zoneCard.cardData) {
            return {
                cardUid: zoneCard.cardUid,
                cardId: zoneCard.cardId || zoneCard.cardUid.split('_')[0],
                basePower: zoneCard.cardData.power || 0,
                gameType: zoneCard.cardData.gameType || '',
                traits: zoneCard.cardData.traits || [],
                name: zoneCard.cardData.name || ''
            };
        }
        
        // Handle legacy structure
        if (zoneCard.card && Array.isArray(zoneCard.card) && zoneCard.card.length > 0) {
            const cardUid = zoneCard.card[0];
            const cardId = cardUid.split('_')[0];
            
            // Look up card data
            const cardData = this.getCardDataById(cardId);
            if (!cardData) {
                console.warn(`❌ Card data not found for ${cardId}`);
                return null;
            }
            
            return {
                cardUid: cardUid,
                cardId: cardId,
                basePower: cardData.power || 0,
                gameType: cardData.gameType || '',
                traits: cardData.traits || [],
                name: cardData.name || ''
            };
        }
        
        console.warn(`❌ Invalid zone card structure:`, zoneCard);
        return null;
    }

    /**
     * 📦 GET CARD DATA BY ID
     * Look up card data from character cards JSON
     */
    private getCardDataById(cardId: string): any {
        if (!this.characterCardsData || !this.characterCardsData.cards) {
            console.warn(`❌ Character cards data not loaded`);
            return null;
        }
        
        return this.characterCardsData.cards[cardId] || null;
    }

    /**
     * 📦 LOAD CHARACTER CARDS DATA
     * Load character cards data for combo calculation
     */
    private loadCharacterCardsData(): void {
        try {
            this.characterCardsData = require('../data/characterCards.json');
            console.log(`✅ Loaded character cards data with ${Object.keys(this.characterCardsData.cards || {}).length} cards`);
        } catch (error) {
            console.error(`❌ Failed to load character cards data:`, error);
            this.characterCardsData = { cards: {} };
        }
    }

    /**
     * 🎯 UPDATE ZONE CARD CURRENT POWER
     * Directly update zone card with calculated currentPower
     */
    private updateZoneCardCurrentPower(zoneCard: any, finalPower: number): void {
        if (zoneCard && typeof zoneCard === 'object') {
            zoneCard.currentPower = finalPower;
            console.log(`      💫 Updated zone card currentPower: ${zoneCard.cardUid} → ${finalPower}`);
        }
    }

    /**
     * 🔧 COUNT OCCURRENCES
     * Helper method to count occurrences in an array
     */
    private countOccurrences(arr: string[]): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const item of arr) {
            counts[item] = (counts[item] || 0) + 1;
        }
        return counts;
    }
}

export default BattleCalculator;