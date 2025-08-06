// src/services/EffectSimulator.ts
/**
 * ENHANCED TYPESCRIPT EFFECT SIMULATOR (January 2025)
 * ==================================================
 * 
 * 🎯 COMPLETE TYPESCRIPT CLASS INTEGRATION
 * 
 * This TypeScript version provides complete integration with the GameEnvironment class,
 * offering type safety, direct method access, and eliminating JSON conversion overhead.
 * 
 * KEY IMPROVEMENTS OVER JAVASCRIPT VERSION:
 * ----------------------------------------
 * ✅ Type Safety: Full TypeScript interfaces and type checking
 * ✅ Direct Class Integration: Works directly with GameEnvironment instances
 * ✅ Performance: No toJSON() overhead when working with class instances
 * ✅ Better IDE Support: IntelliSense, auto-completion, and refactoring
 * ✅ Maintainability: Cleaner code with proper typing and interfaces
 * 
 * CORE FUNCTIONALITY:
 * ------------------
 * - Works directly with GameEnvironment class instances
 * - Processes play sequences using class methods
 * - Applies effects directly to player.fieldEffects
 * - Maintains single source of truth architecture
 * - Provides legacy compatibility for JSON-based operations
 */

import { GameEnvironment, Player, FieldEffect } from '../models/GameEnvironment';
import CardInfoUtils from './CardInfoUtils';

// IMPORTANT: Avoid circular dependency with mozGamePlay
// mozGamePlay imports EffectSimulator, so we cannot import mozGamePlay here
// Instead, we'll use dependency injection to get the calculatePlayerPoint method

// Import required types and interfaces
interface PlaySequenceEntry {
    sequenceId: number;
    playerId: string;
    cardId: string;
    action: string;
    zone: string;
    data?: any;
    timestamp?: string;
    turnNumber?: number;
    phaseWhenPlayed?: string;
}

interface EffectRule {
    id: string;
    type: string;
    trigger: {
        event: string;
        conditions?: any[];
    };
    target: {
        owner: string;
        zones: string[];
        filters?: any[];
    };
    effect: {
        type: string;
        value: any;
    };
}

// Remove local FieldEffect interface - use the one from GameEnvironment

export class EffectSimulator {
    private cardInfoUtils: any = null;
    private calculatePlayerPointFunc: any = null;

    /**
     * Set CardInfoUtils dependency
     * @param cardInfoUtils - CardInfoUtils instance
     */
    public setCardInfoUtils(cardInfoUtils: any): void {
        this.cardInfoUtils = cardInfoUtils;
    }

    /**
     * Set calculatePlayerPoint function dependency to avoid circular imports
     * @param calculatePlayerPointFunc - Function reference from mozGamePlay
     */
    public setCalculatePlayerPointFunction(calculatePlayerPointFunc: any): void {
        this.calculatePlayerPointFunc = calculatePlayerPointFunc;
    }

    /**
     * MAIN METHOD: Enhanced Effect Simulation with GameEnvironment Class
     * ================================================================
     * 
     * Works directly with GameEnvironment class instances, providing better type safety,
     * direct access to class methods, and eliminating toJSON() conversion overhead.
     * 
     * @param gameEnvClass - GameEnvironment class instance
     */
    public async simulateCardPlaySequenceWithClass(gameEnvClass: GameEnvironment): Promise<void> {
        console.log('🎬 Starting enhanced TypeScript class-based effect simulation...');
        
        try {
            // 1. Initialize/Reset fieldEffects using class methods
            this.initializeFieldEffectsWithClass(gameEnvClass);
            
            // 2. Get sorted play sequence using class method
            const sortedPlays = gameEnvClass.playSequenceManager.getPlays();
            
            console.log(`📋 Replaying ${sortedPlays.length} plays directly on GameEnvironment class...`);
            
            // 3. Replay each action in sequence using class methods
            for (const play of sortedPlays) {
                console.log(`▶️ Executing play ${play.sequenceId}: ${play.action} ${play.cardId} by ${play.playerId}`);
                
                // STEP 1: Execute core play action using class methods
                await this.executePlayWithClass(gameEnvClass, play);
                
                // STEP 2: Process ALL card effects using class methods
                await this.processAllCardEffectsWithClass(gameEnvClass, play);
            }
            
            // 4. Calculate final power values using class methods
            await this.calculateFinalPowersWithClass(gameEnvClass);
            
            // 5. Calculate player points using class methods
            await this.calculatePlayerPointsWithClass(gameEnvClass);
            
            console.log('✅ Enhanced TypeScript class-based simulation completed');
            
        } catch (error) {
            console.error('❌ Error in TypeScript EffectSimulator:', error);
            throw error;
        }
    }

    /**
     * Initialize field effects using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     */
    private initializeFieldEffectsWithClass(gameEnvClass: GameEnvironment): void {
        console.log('🔧 Initializing field effects using TypeScript class methods...');
        
        // Get all player IDs from the class
        const playerIds = [gameEnvClass.playerId_1, gameEnvClass.playerId_2].filter(id => id) as string[];
        
        for (const playerId of playerIds) {
            const player = gameEnvClass.getPlayer(playerId);
            if (player) {
                // Initialize player field effects using class method
                player.initializeFieldEffects();
                console.log(`   ✅ Initialized field effects for ${playerId}`);
            }
        }
    }

    /**
     * Execute play action using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    private async executePlayWithClass(gameEnvClass: GameEnvironment, play: PlaySequenceEntry): Promise<void> {
        switch (play.action) {
            case 'PLAY_LEADER':
                await this.executeLeaderPlayWithClass(gameEnvClass, play);
                break;
            case 'PLAY_CARD':
                await this.executeCardPlayWithClass(gameEnvClass, play);
                break;
            case 'APPLY_SET_POWER':
            case 'APPLY_NEUTRALIZATION':
                await this.executeEffectApplicationWithClass(gameEnvClass, play);
                break;
            default:
                console.warn(`Unknown play action: ${play.action}`);
        }
    }

    /**
     * Execute leader play using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    private async executeLeaderPlayWithClass(gameEnvClass: GameEnvironment, play: PlaySequenceEntry): Promise<void> {
        console.log(`   🏛️ Processing PLAY_LEADER: ${play.cardId} for ${play.playerId}`);
        
        const player = gameEnvClass.getPlayer(play.playerId);
        const leaderCard = this.cardInfoUtils?.getCardDetails(play.cardId);
        
        if (!player || !leaderCard) {
            console.warn(`Cannot process leader play - missing player or leader data`);
            return;
        }
        
        // Process leader zone restrictions
        if (leaderCard.zoneCompatibility && player.fieldEffects) {
            const restrictions = {
                top: leaderCard.zoneCompatibility.top || ['ALL'],
                left: leaderCard.zoneCompatibility.left || ['ALL'], 
                right: leaderCard.zoneCompatibility.right || ['ALL'],
                help: ['ALL'],
                sp: ['ALL']
            };
            
            player.fieldEffects.zoneRestrictions = restrictions;
            console.log(`     ✅ Applied zone restrictions for ${play.playerId}`);
        }
        
        // Process leader effects
        if (leaderCard.effects?.rules) {
            for (const rule of leaderCard.effects.rules) {
                await this.processLeaderEffectRuleWithClass(gameEnvClass, rule, play.playerId, play.cardId);
            }
        }
    }

    /**
     * Execute card play using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance  
     * @param play - Play sequence entry
     */
    private async executeCardPlayWithClass(gameEnvClass: GameEnvironment, play: PlaySequenceEntry): Promise<void> {
        console.log(`   🃏 Processing PLAY_CARD: ${play.cardId} for ${play.playerId}`);
        // Card placement is already handled by the zones system
        // This method is for any additional card play processing
    }

    /**
     * Execute effect application using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    private async executeEffectApplicationWithClass(gameEnvClass: GameEnvironment, play: PlaySequenceEntry): Promise<void> {
        console.log(`   ⚡ Processing ${play.action}: ${play.cardId} for ${play.playerId}`);
        
        if (play.action === 'APPLY_SET_POWER' && play.data?.targetCards) {
            for (const targetInfo of play.data.targetCards) {
                await this.applySetPowerEffectWithClass(gameEnvClass, targetInfo, play.data.value);
            }
        }
        // Add other effect applications as needed
    }

    /**
     * Process all card effects using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    private async processAllCardEffectsWithClass(gameEnvClass: GameEnvironment, play: PlaySequenceEntry): Promise<void> {
        // Process immediate effects from the played card
        if (play.cardId && play.playerId) {
            const player = gameEnvClass.getPlayer(play.playerId);
            const cardDetails = this.cardInfoUtils?.getCardDetails(play.cardId);
            
            if (player && cardDetails && cardDetails.effects?.rules) {
                for (const rule of cardDetails.effects.rules) {
                    await this.processCardEffectRuleWithClass(gameEnvClass, rule, play.playerId, play.cardId);
                }
            }
        }
    }

    /**
     * Process leader effect rule using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param rule - Effect rule
     * @param playerId - Player ID
     * @param cardId - Card ID
     */
    private async processLeaderEffectRuleWithClass(
        gameEnvClass: GameEnvironment, 
        rule: EffectRule, 
        playerId: string, 
        cardId: string
    ): Promise<void> {
        const player = gameEnvClass.getPlayer(playerId);
        if (!player) return;
        
        // Create effect object
        const effect: FieldEffect = {
            effectId: `${cardId}_${rule.id}`,
            source: cardId,
            sourcePlayerId: playerId,
            type: rule.effect.type,
            target: this.convertRuleTargetToEffectTarget(rule.target, playerId),
            value: rule.effect.value,
            priority: 0,
            unremovable: false,
            isEnabled: true,
            createdAt: Date.now(),
            effectData: {}
        };
        
        // Add to player's active effects
        if (player.fieldEffects && player.fieldEffects.activeEffects) {
            player.fieldEffects.activeEffects.push(effect);
            console.log(`     ✅ Added leader effect: ${effect.effectId}`);
        }
    }

    /**
     * Process card effect rule using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param rule - Effect rule
     * @param playerId - Player ID
     * @param cardId - Card ID
     */
    private async processCardEffectRuleWithClass(
        gameEnvClass: GameEnvironment, 
        rule: EffectRule, 
        playerId: string, 
        cardId: string
    ): Promise<void> {
        // Similar to processLeaderEffectRuleWithClass but for regular cards
        await this.processLeaderEffectRuleWithClass(gameEnvClass, rule, playerId, cardId);
    }

    /**
     * Calculate final powers using GameEnvironment class methods
     * Updated for unified GameEnvironment structure with proper card lookup
     * @param gameEnvClass - GameEnvironment class instance
     */
    private async calculateFinalPowersWithClass(gameEnvClass: GameEnvironment): Promise<void> {
        console.log('⚡ Calculating final powers using TypeScript class methods...');
        
        const playerIds = [gameEnvClass.playerId_1, gameEnvClass.playerId_2].filter(id => id) as string[];
        
        for (const playerId of playerIds) {
            const player = gameEnvClass.getPlayer(playerId);
            if (!player || !player.fieldEffects) {
                console.log(`   ⚠️ No player or fieldEffects found for ${playerId}`);
                continue;
            }
                
            // Initialize calculatedPowers if not present
            if (!player.fieldEffects.calculatedPowers) {
                player.fieldEffects.calculatedPowers = {};
            }
            
            console.log(`   🔍 Processing cards for player ${playerId}`);
            
            // Get player zones from unified structure
            const zones = gameEnvClass.zones.getPlayerZones(playerId);
            
            // Process each zone
            for (const [zoneName, zoneCards] of Object.entries(zones)) {
                if (!Array.isArray(zoneCards) || zoneCards.length === 0) continue;
                
                console.log(`     📋 Processing zone ${zoneName} with ${zoneCards.length} cards`);
                
                for (const zoneCard of zoneCards) {
                    let cardUid: string | null = null;
                    let cardDetails: any = null;
                    
                    // Handle different zone card types
                    if (zoneName === 'leader') {
                        // Leader zone uses LeaderZoneCard format
                        const leaderCard = zoneCard as any; // LeaderZoneCard
                        cardUid = leaderCard.id;
                        cardDetails = leaderCard; // Already contains full details
                    } else {
                        // Other zones use ZoneCard format
                        const regularCard = zoneCard as any; // ZoneCard
                        if (regularCard.card && regularCard.card.length > 0) {
                            cardUid = regularCard.card[0];
                            
                            // Look up card details using CardInfoUtils
                            if (this.cardInfoUtils) {
                                try {
                                    cardDetails = await this.cardInfoUtils.getCardDetails(cardUid);
                                } catch (error) {
                                    console.error(`     ❌ Error getting card details for ${cardUid}:`, error);
                                    continue;
                                }
                            } else {
                                console.warn(`     ⚠️ CardInfoUtils not available for card lookup: ${cardUid}`);
                                continue;
                            }
                        }
                    }
                    
                    if (!cardUid || !cardDetails) {
                        console.log(`     ⚠️ Skipping invalid card in zone ${zoneName}`);
                        continue;
                    }
                    
                    console.log(`       🎴 Processing card ${cardUid} (${cardDetails.name || 'Unknown'})`);
                    
                    // Calculate final power for this card using ALL active effects
                    const basePower = cardDetails.power || cardDetails.initialPoint || 0;
                    let finalPower = basePower;
                    
                    // Collect ALL active effects from ALL players (cross-player effects)
                    const allActiveEffects: any[] = [];
                    
                    // Add this player's effects
                    if (player.fieldEffects.activeEffects) {
                        allActiveEffects.push(...player.fieldEffects.activeEffects);
                    }
                    
                    // Add opponent's effects that can target this player
                    const opponentId = gameEnvClass.getOpponentId(playerId);
                    if (opponentId) {
                        const opponent = gameEnvClass.getPlayer(opponentId);
                        if (opponent?.fieldEffects?.activeEffects) {
                            // Include opponent effects that target this player
                            for (const opponentEffect of opponent.fieldEffects.activeEffects) {
                                if (opponentEffect.target?.scope === 'OPPONENT' || 
                                    opponentEffect.target?.scope === 'ALL' ||
                                    opponentEffect.target?.playerId === playerId) {
                                    allActiveEffects.push(opponentEffect);
                                }
                            }
                        }
                    }
                    
                    console.log(`         🔧 Applying ${allActiveEffects.length} total active effects (including cross-player)`);
                    
                    // Apply all effects in priority order (setPower effects first, then boosts)
                    const setPowerEffects = allActiveEffects.filter(e => e.type === 'setPower' || e.type === 'POWER_NULLIFICATION');
                    const boostEffects = allActiveEffects.filter(e => e.type === 'powerBoost');
                    const otherEffects = allActiveEffects.filter(e => e.type !== 'setPower' && e.type !== 'POWER_NULLIFICATION' && e.type !== 'powerBoost');
                    
                    // Apply setPower/nullification effects first (they override base power)
                    for (const effect of setPowerEffects) {
                        if (this.isCardTargetedByEffect(cardDetails, effect)) {
                            finalPower = (effect.value as number) || 0;
                            console.log(`           🚫 Applied ${effect.type} ${effect.value} from ${effect.source} (${effect.sourcePlayerId || 'unknown'})`);
                        }
                    }
                    
                    // Then apply power boost effects (additive)
                    for (const effect of boostEffects) {
                        if (this.isCardTargetedByEffect(cardDetails, effect)) {
                            finalPower += (effect.value as number) || 0;
                            console.log(`           ⚡ Applied powerBoost +${effect.value} from ${effect.source} (${effect.sourcePlayerId || 'unknown'})`);
                        }
                    }
                    
                    // Apply other effect types (special effects, immunities, etc.)
                    for (const effect of otherEffects) {
                        if (this.isCardTargetedByEffect(cardDetails, effect)) {
                            console.log(`           ✨ Applied special effect ${effect.type} from ${effect.source} (${effect.sourcePlayerId || 'unknown'})`);
                            // Handle special effects like immunity, zone freedom, etc.
                            // These typically don't modify power directly but could affect other calculations
                        }
                    }
                    
                    // Store calculated power in fieldEffects
                    player.fieldEffects.calculatedPowers[cardUid] = finalPower;
                    console.log(`         💫 Final power for ${cardUid}: ${basePower} → ${finalPower}`);
                }
            }
            
            console.log(`   ✅ Completed power calculation for player ${playerId}`);
            console.log(`      📊 Calculated powers:`, player.fieldEffects.calculatedPowers);
        }
        
        console.log('✅ Final power calculation completed for all players');
    }

    /**
     * Calculate player points using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     */
    private async calculatePlayerPointsWithClass(gameEnvClass: GameEnvironment): Promise<void> {
        console.log('📊 Calculating player points using TypeScript class methods...');
        
        const playerIds = [gameEnvClass.playerId_1, gameEnvClass.playerId_2].filter(id => id) as string[];
        
        for (const playerId of playerIds) {
            const player = gameEnvClass.getPlayer(playerId);
            if (player) {
                // Use existing mozGamePlay logic for point calculation
                const oldPlayerPoint = player.playerPoint || 0;
                
                // Calculate new player point using injected function to avoid circular dependency
                if (this.calculatePlayerPointFunc) {
                    const gameEnvJSON = gameEnvClass.toJSON();
                    const newPlayerPoint = await this.calculatePlayerPointFunc(gameEnvJSON, playerId);
                    player.playerPoint = newPlayerPoint;
                    console.log(`   📊 Player ${playerId}: ${oldPlayerPoint} → ${newPlayerPoint} points`);
                } else {
                    console.warn('⚠️ calculatePlayerPointFunc not set - skipping point calculation');
                    player.playerPoint = oldPlayerPoint; // Keep existing points
                }
            }
        }
    }

    /**
     * Apply set power effect using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param targetInfo - Target card information
     * @param value - Power value to set
     */
    private async applySetPowerEffectWithClass(gameEnvClass: GameEnvironment, targetInfo: any, value: number): Promise<void> {
        const targetPlayer = gameEnvClass.getPlayer(targetInfo.playerId);
        if (targetPlayer?.fieldEffects?.calculatedPowers) {
            targetPlayer.fieldEffects.calculatedPowers[targetInfo.cardId] = value;
            console.log(`     ✅ Set power for ${targetInfo.cardId} to ${value}`);
        }
    }

    /**
     * Convert rule target to effect target
     * @param ruleTarget - Rule target object
     * @param playerId - Player ID
     * @returns Effect target object
     */
    private convertRuleTargetToEffectTarget(ruleTarget: any, playerId: string): any {
        return {
            scope: ruleTarget.owner === 'self' ? 'SELF' : 'OPPONENT',
            playerId: playerId,
            zones: ruleTarget.zones || ['top', 'left', 'right'],
            gameTypes: ruleTarget.filters?.find((f: any) => f.type === 'gameTypeOr')?.values || []
        };
    }

    /**
     * Check if card is targeted by effect
     * @param card - Card object
     * @param effect - Effect object
     * @returns Whether card is targeted
     */
    private isCardTargetedByEffect(card: any, effect: FieldEffect): boolean {
        // Check if effect targets this card based on gameType and other criteria
        if (effect.target.gameTypes && effect.target.gameTypes.length > 0) {
            return effect.target.gameTypes.includes(card.gameType);
        }
        return true; // Default to true if no specific targeting
    }

    // LEGACY COMPATIBILITY: Support for JSON-based operations
    /**
     * Legacy JSON-based simulation for backward compatibility
     * @param gameEnv - Game environment JSON object
     */
    public async simulateCardPlaySequence(gameEnv: any): Promise<void> {
        console.log('⚠️ Using legacy JSON-based simulation - consider upgrading to class-based method');
        
        // Import GameEnvironmentAdapter for conversion
        const { GameEnvironmentAdapter } = require('../utils/GameEnvironmentAdapter');
        
        // Convert to class, process, then update original object
        const gameEnvClass = GameEnvironmentAdapter.fromLegacyJSON(gameEnv);
        await this.simulateCardPlaySequenceWithClass(gameEnvClass);
        
        // Update original gameEnv object with results
        const updatedGameEnv = GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);
        Object.assign(gameEnv, updatedGameEnv);
    }
}

// Export singleton instance for backward compatibility
export const effectSimulator = new EffectSimulator();
export default effectSimulator;