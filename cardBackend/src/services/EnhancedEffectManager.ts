/**
 * EnhancedEffectManager.ts - Refactored effect system using ActiveEffect classes
 * 
 * Eliminates unnecessary transformation layers and directly uses JSON structures
 * with type-safe TypeScript classes for better clarity and maintainability.
 */

import { GameEnvironment } from '../models/GameEnvironment.js';
import { 
    ActiveEffect, 
    ActiveEffectCollection, 
    EffectRule, 
    EffectRuntimeContext 
} from '../models/ActiveEffect.js';
import { PlaySequenceAction } from '../models/GameEnvironment.js';

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
    private effectCollections: Map<string, ActiveEffectCollection> = new Map();
    
    constructor() {
        console.log('🚀 EnhancedEffectManager initialized with direct JSON-to-Class approach');
    }
    
    /**
     * Main orchestration method - simplified workflow without unnecessary transformations
     */
    async processCardEffects(gameEnv: GameEnvironment, play: PlaySequenceAction): Promise<void> {
        console.log(`🎯 Processing card effects for ${play.cardUid} (${play.action})`);
        
        // Get card details
        const cardDetails = this.getCardDetails(gameEnv, play);
        if (!cardDetails?.effects?.rules) {
            console.log(`   ➡️ No effects found for card ${play.cardUid}`);
            return;
        }
        
        // Create ActiveEffect instances directly from JSON rules
        const activeEffects = this.createActiveEffectsFromJSON(cardDetails.effects.rules, play);
        
        // Apply effects to game environment
        await this.applyActiveEffects(gameEnv, activeEffects);
        
        // Store effects for incremental processing (if needed)
        this.storeActiveEffects(play.playerId, activeEffects);
        
        console.log(`   ✅ Processed ${activeEffects.length} effects for ${play.cardUid}`);
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
     */
    private async applyActiveEffects(gameEnv: GameEnvironment, activeEffects: ActiveEffect[]): Promise<void> {
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
                    await this.applySearchCardDirect(gameEnv, effect);
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
        
        // Maintain backward compatibility with legacy format
        const legacyFieldEffect = effect.toLegacyFieldEffect();
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
        
        // Legacy compatibility
        const legacyFieldEffect = effect.toLegacyFieldEffect();
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
     */
    private async applySearchCardDirect(gameEnv: GameEnvironment, effect: ActiveEffect): Promise<void> {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player) return;
        
        // Search card logic (simplified - integrate with existing search system)
        const searchCount = effect.rule.effect.searchCount || 1;
        const selectCount = effect.rule.effect.selectCount || 1;
        
        console.log(`   🔍 Applied search card: search ${searchCount}, select ${selectCount} for ${effect.targetPlayerId}`);
        
        // Note: Full implementation would integrate with CardSelectionHandler
        // This is a simplified version for demonstration
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
    calculateCardPowerWithEffects(
        gameEnv: GameEnvironment, 
        cardId: string, 
        cardData: any, 
        zone: string, 
        playerId: string, 
        basePower: number
    ): number {
        const effectCollection = this.getPlayerEffectCollection(playerId);
        if (!effectCollection) {
            return basePower;
        }
        
        return effectCollection.calculatePowerModification(cardId, cardData, zone, playerId, basePower);
    }
    
    /**
     * Get effect collection for a player
     */
    private getPlayerEffectCollection(playerId: string): ActiveEffectCollection | undefined {
        return this.effectCollections.get(playerId);
    }
    
    /**
     * Store ActiveEffect instances for a player
     */
    private storeActiveEffects(playerId: string, activeEffects: ActiveEffect[]): void {
        let collection = this.effectCollections.get(playerId);
        if (!collection) {
            collection = new ActiveEffectCollection();
            this.effectCollections.set(playerId, collection);
        }
        
        for (const effect of activeEffects) {
            collection.add(effect);
        }
    }
    
    /**
     * Get card details from game environment
     */
    private getCardDetails(gameEnv: GameEnvironment, play: PlaySequenceAction): any {
        // Implementation depends on existing card lookup system
        // This is a simplified version
        const cardId = this.extractCardIdFromUid(play.cardUid);
        
        // Look up card details from game environment or card data system
        // Return card with effects.rules array
        return null; // Placeholder - implement based on existing system
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
     * Clear all effects for a player (for round transitions)
     */
    clearPlayerEffects(playerId: string): void {
        this.effectCollections.delete(playerId);
        console.log(`🧹 Cleared all effects for ${playerId}`);
    }
    
    /**
     * Get all active effects for a player
     */
    getActiveEffects(playerId: string): ActiveEffect[] {
        const collection = this.effectCollections.get(playerId);
        return collection ? collection.getActive() : [];
    }
    
    /**
     * Get effect statistics for debugging
     */
    getEffectStatistics(): any {
        const stats = {
            totalPlayers: this.effectCollections.size,
            playerStats: {} as any
        };
        
        for (const [playerId, collection] of this.effectCollections) {
            stats.playerStats[playerId] = {
                totalEffects: collection.size,
                activeEffects: collection.getActive().length,
                effectTypes: collection.getActive().reduce((acc, effect) => {
                    acc[effect.effectType] = (acc[effect.effectType] || 0) + 1;
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