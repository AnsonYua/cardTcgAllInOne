/**
 * EnhancedEffectManager.ts - Refactored effect system using ActiveEffect classes
 * 
 * Eliminates unnecessary transformation layers and directly uses JSON structures
 * with type-safe TypeScript classes for better clarity and maintainability.
 */

import { GameEnvironment, EnhancedFieldEffect, PlaySequenceAction } from '../models/GameEnvironment';
import { 
    ActiveEffect, 
    EffectRule, 
    EffectRuntimeContext 
} from '../models/ActiveEffect';

/**
 * Enhanced Effect Manager - Direct JSON-to-Class approach
 * 
 * Key improvements:
 * 1. Eliminates CalculatedEffect intermediate layer
 * 2. Direct JSON effect rule usage with runtime context
 * 3. Type-safe effect processing with ActiveEffect classes
 * 4. Clear separation of concerns
 * 5. Maintains backward compatibility
 */
export class EnhancedEffectManager {
    private calculatePlayerPointFunc: any = null;
    private cardInfoUtils: any = null;
    
    constructor() {
        console.log('🚀 EnhancedEffectManager initialized with direct JSON-to-Class approach');
        this.initializeCardInfoUtils();
    }
    
    /**
     * Initialize CardInfoUtils for card data lookup
     */
    private initializeCardInfoUtils(): void {
        try {
            const { CardInfoUtils } = require('./CardInfoUtils');
            this.cardInfoUtils = new CardInfoUtils();
            console.log('✅ CardInfoUtils initialized in EnhancedEffectManager');
        } catch (error) {
            console.error('❌ Failed to initialize CardInfoUtils:', error);
        }
    }
    
    /**
     * Set calculatePlayerPoint function dependency
     */
    public setCalculatePlayerPointFunction(calculatePlayerPointFunc: any): void {
        this.calculatePlayerPointFunc = calculatePlayerPointFunc;
    }
    
    /**
     * Main orchestration method - simplified workflow without unnecessary transformations
     * Now returns selection requirements for search effects
     */
    async processCardEffects(gameEnv: GameEnvironment, play: PlaySequenceAction): Promise<{
        requiresCardSelection?: boolean;
        selectionData?: any;
    }> {
        console.log(`🎯 Processing card effects for ${play.cardUid} (${play.action})`);
        
        // Get card details
        const cardDetails = this.getCardDetails(gameEnv, play);
        if (!cardDetails?.effects?.rules) {
            console.log(`   ➡️ No effects found for card ${play.cardUid}`);
            return {};
        }
        
        // Create ActiveEffect instances directly from JSON rules
        const activeEffects = this.createActiveEffectsFromJSON(cardDetails.effects.rules, play);
        
        // Apply effects to game environment and check for selection requirements
        // Note: Individual apply methods already store effects in fieldEffects - no separate storage needed
        const selectionResult = await this.applyActiveEffects(gameEnv, activeEffects);
        
        // Update player points if calculation function is available
        if (this.calculatePlayerPointFunc) {
            try {
                for (const playerId of Object.keys(gameEnv.players)) {
                    const newPoints = await this.calculatePlayerPointFunc(gameEnv.toJSON(), playerId);
                    gameEnv.players[playerId].playerPoint = newPoints;
                }
            } catch (error) {
                console.error('❌ Error calculating player points:', error);
            }
        }
        
        console.log(`   ✅ Processed ${activeEffects.length} effects for ${play.cardUid}`);
        return selectionResult || {};
    }
    
    /**
     * Create ActiveEffect instances directly from JSON effect rules
     * Eliminates the CalculatedEffect intermediate layer
     */
    private createActiveEffectsFromJSON(rules: EffectRule[], play: PlaySequenceAction): ActiveEffect[] {
        const activeEffects: ActiveEffect[] = [];
        
        for (const rule of rules) {
            // Determine target player based on rule
            const targetPlayerId = this.determineTargetPlayer(rule, play);
            
            // Create ActiveEffect directly from JSON rule
            const activeEffect = ActiveEffect.fromCardRule(
                rule,
                play.cardUid,
                play.playerId,
                targetPlayerId
            );
            
            activeEffects.push(activeEffect);
            
            console.log(`   📝 Created ActiveEffect: ${activeEffect.getDescription()}`);
        }
        
        return activeEffects;
    }
    
    /**
     * Determine target player for effect
     */
    private determineTargetPlayer(rule: EffectRule, play: PlaySequenceAction): string {
        switch (rule.target.owner) {
            case 'self':
                return play.playerId;
            case 'opponent':
                return this.getOpponentId(play.playerId);
            default:
                return play.playerId;
        }
    }
    
    /**
     * Apply ActiveEffect instances to game environment
     * Direct application without unnecessary data transformations
     * Now returns selection requirements for search effects
     */
    private async applyActiveEffects(gameEnv: GameEnvironment, activeEffects: ActiveEffect[]): Promise<{
        requiresCardSelection?: boolean;
        selectionData?: any;
    }> {
        let selectionResult: { requiresCardSelection?: boolean; selectionData?: any } = {};
        
        for (const effect of activeEffects) {
            switch (effect.effectType) {
                case 'powerBoost':
                    this.applyPowerBoostDirect(gameEnv, effect);
                    break;
                    
                case 'setPower':
                    this.applySetPowerDirect(gameEnv, effect);
                    break;
                    
                case 'drawCards':
                    await this.applyDrawCardsDirect(gameEnv, effect);
                    break;
                    
                case 'searchCard':
                    const searchResult = await this.applySearchCardDirect(gameEnv, effect);
                    if (searchResult?.requiresCardSelection) {
                        selectionResult = searchResult;
                    }
                    break;
                    
                case 'neutralizeEffect':
                    this.applyNeutralizeEffectDirect(gameEnv, effect);
                    break;
                    
                case 'preventSummon':
                    this.applyPreventSummonDirect(gameEnv, effect);
                    break;
                    
                default:
                    console.warn(`   ⚠️ Unknown effect type: ${effect.effectType}`);
            }
        }
        
        return selectionResult;
    }
    
    /**
     * Apply power boost effect directly from ActiveEffect
     * No parsing needed - use original JSON structure
     */
    private applyPowerBoostDirect(gameEnv: GameEnvironment, effect: ActiveEffect): void {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player?.fieldEffects) {
            console.warn(`   ⚠️ Player ${effect.targetPlayerId} not found or missing fieldEffects`);
            return;
        }
        
        // Convert ActiveEffect to enhanced field effect format
        const enhancedFieldEffect = {
            effectId: effect.effectId,
            sourceCardUid: effect.sourceCardUid,
            sourcePlayerId: effect.sourcePlayerId,
            targetPlayerId: effect.targetPlayerId,
            createdAt: effect.createdAt,
            isActive: effect.isActive,
            rule: effect.rule
        };
        
        // Store in enhanced format
        if (!player.fieldEffects.activeEffectsEnhanced) {
            player.fieldEffects.activeEffectsEnhanced = [];
        }
        player.fieldEffects.activeEffectsEnhanced.push(enhancedFieldEffect);
        
        // Maintain backward compatibility with legacy format using direct properties
        const legacyFieldEffect = {
            effectId: effect.effectId,
            source: effect.sourceCardUid,
            sourcePlayerId: effect.sourcePlayerId,
            type: effect.effectType,
            target: {
                scope: (effect.targetScope === 'opponent' ? 'OPPONENT' : effect.targetScope === 'both' ? 'ALL' : 'SELF') as 'OPPONENT' | 'ALL' | 'SELF',
                zones: effect.rule.target.zones as any,
                gameTypes: effect.rule.target.filters?.filter(f => f.type === 'gameType').map(f => f.value || '').filter(Boolean),
                traits: effect.rule.target.filters?.filter(f => f.type === 'trait').map(f => f.value || '').filter(Boolean)
            },
            value: effect.effectValue,
            isEnabled: effect.isActive,
            createdAt: effect.createdAt
        };
        player.fieldEffects.activeEffects.push(legacyFieldEffect);
        
        console.log(`   ⚡ Applied power boost: +${effect.effectValue} for ${effect.targetPlayerId}`);
        console.log(`   📊 Targeting: ${effect.rule.target.zones.join(', ')} zones with filters: ${JSON.stringify(effect.rule.target.filters)}`);
    }
    
    /**
     * Apply set power effect directly from ActiveEffect
     */
    private applySetPowerDirect(gameEnv: GameEnvironment, effect: ActiveEffect): void {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player?.fieldEffects) return;
        
        // Store enhanced format
        if (!player.fieldEffects.activeEffectsEnhanced) {
            player.fieldEffects.activeEffectsEnhanced = [];
        }
        
        const enhancedFieldEffect = {
            effectId: effect.effectId,
            sourceCardUid: effect.sourceCardUid,
            sourcePlayerId: effect.sourcePlayerId,
            targetPlayerId: effect.targetPlayerId,
            createdAt: effect.createdAt,
            isActive: effect.isActive,
            rule: effect.rule
        };
        
        player.fieldEffects.activeEffectsEnhanced.push(enhancedFieldEffect);
        
        // Legacy compatibility using direct properties
        const legacyFieldEffect = {
            effectId: effect.effectId,
            source: effect.sourceCardUid,
            sourcePlayerId: effect.sourcePlayerId,
            type: effect.effectType,
            target: {
                scope: (effect.targetScope === 'opponent' ? 'OPPONENT' : effect.targetScope === 'both' ? 'ALL' : 'SELF') as 'OPPONENT' | 'ALL' | 'SELF',
                zones: effect.rule.target.zones as any,
                gameTypes: effect.rule.target.filters?.filter(f => f.type === 'gameType').map(f => f.value || '').filter(Boolean),
                traits: effect.rule.target.filters?.filter(f => f.type === 'trait').map(f => f.value || '').filter(Boolean)
            },
            value: effect.effectValue,
            isEnabled: effect.isActive,
            createdAt: effect.createdAt
        };
        player.fieldEffects.activeEffects.push(legacyFieldEffect);
        
        console.log(`   🎯 Applied set power: ${effect.effectValue} for ${effect.targetPlayerId}`);
    }
    
    /**
     * Apply draw cards effect directly from ActiveEffect
     */
    private async applyDrawCardsDirect(gameEnv: GameEnvironment, effect: ActiveEffect): Promise<void> {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player) return;
        
        const drawCount = effect.effectValue as number;
        
        // Draw cards logic (simplified - integrate with existing draw system)
        for (let i = 0; i < drawCount; i++) {
            if (player.deck.mainDeck.length > 0) {
                const drawnCard = player.deck.mainDeck.shift();
                if (drawnCard) {
                    player.deck.hand.push(drawnCard);
                }
            }
        }
        
        console.log(`   🃏 Applied draw cards: ${drawCount} cards for ${effect.targetPlayerId}`);
    }
    
    /**
     * Apply search card effect directly from ActiveEffect
     * Returns selection requirement for frontend handling
     */
    private async applySearchCardDirect(gameEnv: GameEnvironment, effect: ActiveEffect): Promise<{
        requiresCardSelection?: boolean;
        selectionData?: any;
    }> {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player) return {};
        
        // Extract search parameters from effect rule
        const searchCount = effect.rule.effect.searchCount || 7;
        const selectCount = effect.rule.effect.selectCount || 1;
        const destination = effect.rule.effect.destination || 'hand';
        
        console.log(`   🔍 Processing search effect: search ${searchCount}, select ${selectCount}, destination: ${destination}`);
        
        // Create pending card selection in gameEnv
        const selectionId = `${effect.targetPlayerId}_search_${Date.now()}`;
        
        if (!gameEnv.pendingCardSelections) {
            gameEnv.pendingCardSelections = {};
        }
        
        // Get eligible cards from deck based on effect filters
        const eligibleCards = this.getEligibleCardsForSearch(gameEnv, effect, searchCount);
        
        gameEnv.pendingCardSelections[selectionId] = {
            playerId: effect.targetPlayerId,
            eligibleCards: eligibleCards,
            selectCount: selectCount,
            effect: {
                type: 'searchCard',
                destination: destination,
                sourceCard: effect.sourceCardUid
            },
            effectType: 'searchCard',
            sourceCard: effect.sourceCardUid
        };
        
        // Set pending player action
        gameEnv.pendingPlayerAction = {
            type: 'cardSelection',
            selectionId: selectionId
        };
        
        console.log(`   🎯 Created card selection requirement: ${selectionId}`);
        
        return {
            requiresCardSelection: true,
            selectionData: {
                selectionId: selectionId,
                playerId: effect.targetPlayerId,
                searchCount: searchCount,
                selectCount: selectCount,
                destination: destination
            }
        };
    }
    
    /**
     * Get eligible cards for search effect
     */
    private getEligibleCardsForSearch(gameEnv: GameEnvironment, effect: ActiveEffect, searchCount: number): any[] {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player?.deck?.mainDeck) return [];
        
        // Get top cards from deck for search
        const searchCards = player.deck.mainDeck.slice(0, Math.min(searchCount, player.deck.mainDeck.length));
        
        // Convert to card selection format with card details
        return searchCards.map(cardUid => {
            const cardId = this.extractCardIdFromUid(cardUid);
            const cardDetails = this.getCardDetailsByCardId(cardId);
            
            return {
                cardId: cardId,
                cardUid: cardUid,
                zone: 'deck',
                cardData: cardDetails || { id: cardId, name: `Card ${cardId}` }
            };
        });
    }
    
    /**
     * Get card details by card ID using CardInfoUtils instance
     */
    private getCardDetailsByCardId(cardId: string): any {
        if (!this.cardInfoUtils) {
            console.error('❌ CardInfoUtils not initialized for getCardDetailsByCardId');
            return {
                id: cardId,
                name: `Card ${cardId}`,
                cardType: 'character',
                power: 100
            };
        }
        
        const cardDetails = this.cardInfoUtils.getCardDetails(cardId);
        if (!cardDetails) {
            console.warn(`⚠️ Card details not found for ${cardId}, returning fallback`);
            return {
                id: cardId,
                name: `Card ${cardId}`,
                cardType: 'character',
                power: 100
            };
        }
        
        return cardDetails;
    }
    
    /**
     * Apply neutralize effect directly from ActiveEffect
     */
    private applyNeutralizeEffectDirect(gameEnv: GameEnvironment, effect: ActiveEffect): void {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player?.fieldEffects) return;
        
        // Store special effect
        if (!player.fieldEffects.specialEffects) {
            player.fieldEffects.specialEffects = {};
        }
        
        if (effect.rule.effect.type === 'neutralizeEffect') {
            player.fieldEffects.specialEffects.immuneToNeutralization = effect.effectValue as boolean;
        }
        
        console.log(`   🛡️ Applied neutralize effect: ${effect.effectValue} for ${effect.targetPlayerId}`);
    }
    
    /**
     * Apply prevent summon effect directly from ActiveEffect
     */
    private applyPreventSummonDirect(gameEnv: GameEnvironment, effect: ActiveEffect): void {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player?.fieldEffects) return;
        
        // Store zone restriction
        if (effect.rule.target.zones) {
            for (const zone of effect.rule.target.zones) {
                if (zone in player.fieldEffects.zoneRestrictions) {
                    player.fieldEffects.zoneRestrictions[zone as keyof typeof player.fieldEffects.zoneRestrictions] = [];
                }
            }
        }
        
        console.log(`   🚫 Applied prevent summon for zones: ${effect.rule.target.zones.join(', ')}`);
    }
    
    /**
     * Calculate total power for a card using ActiveEffect collection
     */
    
    /**
     * Get card details using CardInfoUtils instance
     */
    private getCardDetails(gameEnv: GameEnvironment, play: PlaySequenceAction): any {
        const cardId = this.extractCardIdFromUid(play.cardUid);
        
        if (!this.cardInfoUtils) {
            console.error('❌ CardInfoUtils not initialized in EnhancedEffectManager');
            return null;
        }
        
        const cardDetails = this.cardInfoUtils.getCardDetails(cardId);
        if (!cardDetails) {
            console.warn(`⚠️ Card details not found for ${cardId}`);
            return null;
        }
        
        return cardDetails;
    }
    
    /**
     * Extract card ID from UID
     */
    private extractCardIdFromUid(cardUid: string): string {
        return cardUid.split('_')[0];
    }
    
    /**
     * Get opponent player ID
     */
    private getOpponentId(playerId: string): string {
        // Implementation depends on existing player management
        // This is a simplified version
        return playerId === 'playerId_1' ? 'playerId_2' : 'playerId_1';
    }
    
    /**
     * Clear all effects for a player from fieldEffects (for round transitions)
     */
    clearPlayerEffects(gameEnv: GameEnvironment, playerId: string): void {
        const player = gameEnv.players[playerId];
        if (player?.fieldEffects?.activeEffectsEnhanced) {
            player.fieldEffects.activeEffectsEnhanced = [];
        }
        console.log(`🧹 Cleared all effects for ${playerId}`);
    }
    
    /**
     * Get all active effects for a player from fieldEffects (as EnhancedFieldEffect)
     */
    getActiveEffects(gameEnv: GameEnvironment, playerId: string): EnhancedFieldEffect[] {
        const player = gameEnv.players[playerId];
        return player?.fieldEffects?.activeEffectsEnhanced || [];
    }
    
    /**
     * Process all existing play sequence actions for their effects
     * Used during game initialization and state reconstruction
     */
    async processAllExistingEffects(gameEnv: GameEnvironment): Promise<void> {
        console.log('🔄 Processing all existing play sequence actions for effects...');
        
        if (!gameEnv.playSequenceManager) {
            console.log('   ➡️ No play sequence manager found');
            return;
        }
        
        const plays = gameEnv.playSequenceManager.getPlays();
        console.log(`   📊 Found ${plays.length} plays to process`);
        
        // Process each play in sequence order
        for (const play of plays) {
            try {
                const result = await this.processCardEffects(gameEnv, play);
                // Note: During initialization, we don't handle card selection requirements
                // as these are for runtime interactions only
                if (result.requiresCardSelection) {
                    console.log(`   🔍 Skipping card selection requirement during initialization for ${play.cardUid}`);
                }
            } catch (error) {
                console.error(`❌ Error processing play ${play.sequenceId}:`, error);
                // Continue with other plays
            }
        }
        
        console.log('✅ Completed processing all existing effects');
    }
    
    /**
     * Calculate player points using integrated calculation function
     */
    async calculatePlayerPoints(gameEnv: GameEnvironment, playerId: string): Promise<number> {
        if (!this.calculatePlayerPointFunc) {
            console.warn('⚠️ calculatePlayerPointFunc not set - returning 0');
            return 0;
        }
        
        try {
            const points = await this.calculatePlayerPointFunc(gameEnv.toJSON(), playerId);
            console.log(`📊 Calculated ${points} points for ${playerId}`);
            return points;
        } catch (error) {
            console.error(`❌ Error calculating points for ${playerId}:`, error);
            return 0;
        }
    }

    /**
     * Get effect statistics for debugging from fieldEffects
     */
    getEffectStatistics(gameEnv: GameEnvironment): any {
        const stats = {
            totalPlayers: Object.keys(gameEnv.players).length,
            playerStats: {} as any
        };
        
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            const effects = player.fieldEffects?.activeEffectsEnhanced || [];
            stats.playerStats[playerId] = {
                totalEffects: effects.length,
                activeEffects: effects.length,
                effectTypes: effects.reduce((acc, effect) => {
                    const effectType = effect.rule.effect.type;
                    acc[effectType] = (acc[effectType] || 0) + 1;
                    return acc;
                }, {} as any)
            };
        }
        
        return stats;
    }
}

/**
 * Singleton instance for global access
 */
export const enhancedEffectManager = new EnhancedEffectManager();