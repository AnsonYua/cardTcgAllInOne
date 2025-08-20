/**
 * EnhancedEffectManager.ts - Refactored effect system using ActiveEffect classes
 * 
 * Eliminates unnecessary transformation layers and directly uses JSON structures
 * with type-safe TypeScript classes for better clarity and maintainability.
 */

import { GameEnvironment, PlaySequenceAction, FieldEffect } from '../models/GameEnvironment';
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
     * Now supports trigger event filtering for correct effect processing
     */
    async processCardEffects(gameEnv: GameEnvironment, play: PlaySequenceAction, triggerEvent?: string): Promise<{
        requiresCardSelection?: boolean;
        selectionData?: any;
    }> {
        console.log(`🎯 Processing card effects for ${play.cardUid} (${play.action}) with trigger: ${triggerEvent || 'default'}`);
        
        // Get card details
        const cardDetails = this.getCardDetails(gameEnv, play);
        if (!cardDetails?.effects?.rules) {
            console.log(`   ➡️ No effects found for card ${play.cardUid}`);
            return {};
        }
        
        // Create ActiveEffect instances directly from JSON rules with trigger filtering
        const activeEffects = this.createActiveEffectsFromJSON(cardDetails.effects.rules, play, triggerEvent);
        
        // Apply effects to game environment and check for selection requirements
        // Note: Individual apply methods already store effects in fieldEffects - no separate storage needed
        const selectionResult = await this.applyActiveEffects(gameEnv, activeEffects);
        
        // Update player points if calculation function is available
        if (this.calculatePlayerPointFunc) {
            try {
                for (const playerId of Object.keys(gameEnv.players)) {
                    // Pass GameEnvironment class directly, not JSON
                    const newPoints = await this.calculatePlayerPointFunc(gameEnv, playerId);
                    gameEnv.players[playerId].playerPoint = newPoints;
                    console.log(`✅ Updated ${playerId} playerPoint: ${newPoints}`);
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
     * Now includes trigger event filtering for correct effect processing
     */
    private createActiveEffectsFromJSON(rules: EffectRule[], play: PlaySequenceAction, triggerEvent?: string): ActiveEffect[] {
        const activeEffects: ActiveEffect[] = [];
        
        for (const rule of rules) {
            // CRITICAL FIX: Filter effects based on trigger event
            if (!this.shouldProcessEffect(rule, triggerEvent)) {
                console.log(`   ⏭️ Skipping effect ${rule.id} - trigger mismatch (rule: ${rule.type}/${rule.trigger?.event}, current: ${triggerEvent})`);
                continue;
            }
            
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
            
            console.log(`   📝 Created ActiveEffect: ${activeEffect.getDescription()} (trigger: ${rule.trigger?.event})`);
        }
        
        console.log(`   🎯 Processed ${activeEffects.length} matching effects out of ${rules.length} total rules`);
        return activeEffects;
    }
    
    /**
     * Determine if an effect should be processed based on trigger event
     */
    private shouldProcessEffect(rule: EffectRule, triggerEvent?: string): boolean {
        // If no trigger event specified, process all effects (backward compatibility)
        if (!triggerEvent) {
            return true;
        }
        
        // Handle different effect types
        switch (rule.type) {
            case 'triggered':
                // Triggered effects only process when their trigger event matches
                return rule.trigger?.event === triggerEvent;
                
            case 'continuous':
                // Continuous effects are processed during power calculation, not during card play
                // Skip them during onSummon/onPlay events
                if (triggerEvent === 'onSummon' || triggerEvent === 'onPlay') {
                    return false;
                }
                // Process continuous effects during other contexts (like power calculation)
                return triggerEvent === 'always' || triggerEvent === 'powerCalculation';
                
            default:
                // Unknown effect types - process by default for safety
                console.warn(`   ⚠️ Unknown effect type: ${rule.type}, processing by default`);
                return true;
        }
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
                    const powerBoostResult = await this.applyPowerBoostDirect(gameEnv, effect);
                    if (powerBoostResult?.requiresCardSelection) {
                        selectionResult = powerBoostResult;
                    }
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
     * Now supports requiresSelection for manual target selection
     */
    private async applyPowerBoostDirect(gameEnv: GameEnvironment, effect: ActiveEffect): Promise<{
        requiresCardSelection?: boolean;
        selectionData?: any;
    }> {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player?.fieldEffects) {
            console.warn(`   ⚠️ Player ${effect.targetPlayerId} not found or missing fieldEffects`);
            return {};
        }
        
        // Check if effect requires manual target selection
        if (effect.requiresSelection) {
            console.log(`   🎯 Power boost effect requires manual target selection`);
            return await this.createCardSelectionForPowerBoost(gameEnv, effect);
        }
        
        // Store effect in activeEffects format
        const fieldEffect = {
            effectId: effect.effectId,
            source: effect.sourceCardUid,
            sourcePlayerId: effect.sourcePlayerId,
            type: effect.effectType,
            target: {
                scope: (effect.targetScope === 'opponent' ? 'OPPONENT' : effect.targetScope === 'both' ? 'ALL' : 'SELF') as 'OPPONENT' | 'ALL' | 'SELF',
                zones: effect.rule.target.zones as any,
                gameTypes: effect.rule.target.filters?.filter(f => f.type === 'gameType').map(f => f.value || '').filter(Boolean),
                traits: effect.rule.target.filters?.filter(f => f.type === 'trait').map(f => f.value || '').filter(Boolean),
                nameContains: effect.rule.target.filters?.filter(f => f.type === 'nameContains').map(f => f.value || '').filter(Boolean)
            },
            value: effect.effectValue,
            isEnabled: effect.isActive,
            createdAt: effect.createdAt
        };
        player.fieldEffects.activeEffects.push(fieldEffect);
        
        console.log(`   ⚡ Applied power boost: +${effect.effectValue} for ${effect.targetPlayerId}`);
        console.log(`   📊 Targeting: ${effect.rule.target.zones.join(', ')} zones with filters: ${JSON.stringify(effect.rule.target.filters)}`);
        
        return {}; // No selection required
    }
    
    /**
     * Create card selection for power boost effects that require manual targeting
     * Reuses existing pendingCardSelections system
     */
    private async createCardSelectionForPowerBoost(gameEnv: GameEnvironment, effect: ActiveEffect): Promise<{
        requiresCardSelection?: boolean;
        selectionData?: any;
    }> {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player) return {};
        
        // Extract selection parameters from effect rule
        const selectCount = effect.rule.target.selectCount || 1;
        
        console.log(`   🔍 Creating powerBoost target selection: select ${selectCount} targets`);
        
        // Create pending card selection in gameEnv
        const selectionId = `${effect.targetPlayerId}_powerBoost_${Date.now()}`;
        
        if (!gameEnv.pendingCardSelections) {
            gameEnv.pendingCardSelections = {};
        }
        
        // Get eligible cards from player's zones based on effect filters
        const eligibleCards = this.getEligibleCardsForPowerBoost(gameEnv, effect);
        
        gameEnv.pendingCardSelections[selectionId] = {
            playerId: effect.targetPlayerId,
            eligibleCards: eligibleCards,
            selectCount: selectCount,
            effect: {
                type: 'powerBoost',
                value: effect.effectValue,
                sourceCard: effect.sourceCardUid
            },
            effectType: 'powerBoost',
            selectionType: this.getDynamicSelectionType(effect), // Dynamic selectionType from card data
            sourceCard: effect.sourceCardUid,
            targetPlayerId: effect.targetPlayerId
        };
        
        // REFACTOR: Remove pendingPlayerAction - selection detected via pendingCardSelections
        // Selection existence handled by hasPendingCardSelection() helper method
        
        console.log(`   🎯 Created powerBoost selection requirement: ${selectionId} with ${eligibleCards.length} eligible targets`);
        
        return {
            requiresCardSelection: true,
            selectionData: {
                selectionId: selectionId,
                playerId: effect.targetPlayerId,
                selectCount: selectCount,
                effectType: 'powerBoost',
                value: effect.effectValue
            }
        };
    }
    
    /**
     * Get eligible cards for power boost target selection
     */
    private getEligibleCardsForPowerBoost(gameEnv: GameEnvironment, effect: ActiveEffect): any[] {
        const targetPlayerId = effect.targetPlayerId;
        const zones = effect.rule.target.zones;
        const filters = effect.rule.target.filters || [];
        
        const eligibleCards: any[] = [];
        
        // Check each specified zone
        for (const zone of zones) {
            const playerZones = gameEnv.zones.getPlayerZones(targetPlayerId);
            if (!playerZones) continue;
            
            // Type-safe zone access
            let zoneCards: any[] | undefined;
            switch (zone) {
                case 'top':
                    zoneCards = playerZones.top;
                    break;
                case 'left':
                    zoneCards = playerZones.left;
                    break;
                case 'right':
                    zoneCards = playerZones.right;
                    break;
                case 'help':
                    zoneCards = playerZones.help;
                    break;
                case 'sp':
                    zoneCards = playerZones.sp;
                    break;
                case 'leader':
                    zoneCards = playerZones.leader;
                    break;
                default:
                    continue;
            }
            
            if (!Array.isArray(zoneCards)) continue;
            
            for (const zoneCard of zoneCards) {
                const cardData = this.extractCardDataFromZone(zoneCard);
                if (!cardData) continue;
                
                // Skip face-down cards
                if (cardData.isFaceDown) continue;
                
                // Apply filters
                if (this.cardMatchesFilters(cardData, filters)) {
                    eligibleCards.push({
                        cardId: cardData.cardId,
                        cardUid: cardData.cardUid,
                        zone: zone,
                        cardData: {
                            id: cardData.cardId,
                            name: cardData.name,
                            power: cardData.basePower,
                            gameType: cardData.gameType,
                            traits: cardData.traits
                        }
                    });
                }
            }
        }
        
        return eligibleCards;
    }
    
    /**
     * Helper method to extract card data from zone card (reused from BattleCalculator pattern)
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
                name: zoneCard.cardData.name || '',
                isFaceDown: zoneCard.isFaceDown || false
            };
        }
        
        // Handle legacy structure
        if (zoneCard.card && Array.isArray(zoneCard.card) && zoneCard.card.length > 0) {
            const cardUid = zoneCard.card[0];
            const cardId = cardUid.split('_')[0];
            
            // Look up card data
            const cardData = this.getCardDetailsByCardId(cardId);
            if (!cardData) return null;
            
            return {
                cardUid: cardUid,
                cardId: cardId,
                basePower: cardData.power || 0,
                gameType: cardData.gameType || '',
                traits: cardData.traits || [],
                name: cardData.name || '',
                isFaceDown: zoneCard.isBack || false
            };
        }
        
        return null;
    }
    
    /**
     * Helper method to check if a card matches effect filters
     */
    private cardMatchesFilters(cardData: any, filters: any[]): boolean {
        for (const filter of filters) {
            switch (filter.type) {
                case 'gameType':
                    if (cardData.gameType !== filter.value) return false;
                    break;
                case 'trait':
                    if (!cardData.traits || !cardData.traits.includes(filter.value)) return false;
                    break;
                case 'nameContains':
                    if (!cardData.name || !cardData.name.includes(filter.value)) return false;
                    break;
                // Add more filter types as needed
            }
        }
        return true;
    }
    
    /**
     * Apply set power effect directly from ActiveEffect
     */
    private applySetPowerDirect(gameEnv: GameEnvironment, effect: ActiveEffect): void {
        const player = gameEnv.players[effect.targetPlayerId];
        if (!player?.fieldEffects) return;
        
        // Store effect in activeEffects format
        const fieldEffect = {
            effectId: effect.effectId,
            source: effect.sourceCardUid,
            sourcePlayerId: effect.sourcePlayerId,
            type: effect.effectType,
            target: {
                scope: (effect.targetScope === 'opponent' ? 'OPPONENT' : effect.targetScope === 'both' ? 'ALL' : 'SELF') as 'OPPONENT' | 'ALL' | 'SELF',
                zones: effect.rule.target.zones as any,
                gameTypes: effect.rule.target.filters?.filter(f => f.type === 'gameType').map(f => f.value || '').filter(Boolean),
                traits: effect.rule.target.filters?.filter(f => f.type === 'trait').map(f => f.value || '').filter(Boolean),
                nameContains: effect.rule.target.filters?.filter(f => f.type === 'nameContains').map(f => f.value || '').filter(Boolean)
            },
            value: effect.effectValue,
            isEnabled: effect.isActive,
            createdAt: effect.createdAt
        };
        player.fieldEffects.activeEffects.push(fieldEffect);
        
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
            selectionType: this.getDynamicSelectionType(effect), // Dynamic selectionType from card data
            sourceCard: effect.sourceCardUid
        };
        
        // REFACTOR: Remove pendingPlayerAction - selection detected via pendingCardSelections
        // Selection existence handled by hasPendingCardSelection() helper method
        
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
     * Get matching effect rule from card data for an ActiveEffect
     */
    private getMatchingEffectRule(effect: ActiveEffect): any {
        const cardId = this.extractCardIdFromUid(effect.sourceCardUid);
        const cardDetails = this.getCardDetailsByCardId(cardId);
        
        if (!cardDetails?.effects?.rules) {
            return null;
        }
        
        const matchingRule = cardDetails.effects.rules.find((rule: any) => 
            rule.id === effect.rule.id || 
            (rule.effect.type === effect.effectType && rule.type === effect.rule.type)
        );
        
        return matchingRule;
    }

    /**
     * Get selectionType dynamically from card data instead of hardcoding
     */
    private getDynamicSelectionType(effect: ActiveEffect): string {
        try {
            const cardId = this.extractCardIdFromUid(effect.sourceCardUid);
            const matchingRule = this.getMatchingEffectRule(effect);
            
            if (!matchingRule) {
                console.warn(`⚠️ No matching effect rule found for card ${cardId}, using fallback`);
                return this.getDefaultSelectionType(effect.effectType);
            }
            
            if (matchingRule?.effect?.selectionType) {
                console.log(`   ✅ Found dynamic selectionType: ${matchingRule.effect.selectionType} for ${cardId}/${effect.rule.id}`);
                return matchingRule.effect.selectionType;
            }
            
            // Fallback to default selection type based on effect type
            const fallbackType = this.getDefaultSelectionType(effect.effectType);
            console.log(`   ⚠️ Using fallback selectionType: ${fallbackType} for ${cardId}/${effect.effectType}`);
            return fallbackType;
            
        } catch (error) {
            console.error(`❌ Error getting selectionType for effect:`, error);
            return this.getDefaultSelectionType(effect.effectType);
        }
    }
    
    /**
     * Get default selectionType based on effect type (fallback)
     */
    private getDefaultSelectionType(effectType: string): string {
        const defaultMappings: { [key: string]: string } = {
            'powerBoost': 'targetSelection',
            'searchCard': 'deckSearch',
            'setPower': 'targetSelection',
            'drawCards': 'cardDraw',
            'neutralizeEffect': 'neutralize'
        };
        
        return defaultMappings[effectType] || 'generic';
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
        if (player?.fieldEffects?.activeEffects) {
            player.fieldEffects.activeEffects = [];
        }
        console.log(`🧹 Cleared all effects for ${playerId}`);
    }
    
    /**
     * Get all active effects for a player from fieldEffects
     */
    getActiveEffects(gameEnv: GameEnvironment, playerId: string): FieldEffect[] {
        const player = gameEnv.players[playerId];
        return player?.fieldEffects?.activeEffects || [];
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
            const effects = player.fieldEffects?.activeEffects || [];
            stats.playerStats[playerId] = {
                totalEffects: effects.length,
                activeEffects: effects.length,
                effectTypes: effects.reduce((acc, effect) => {
                    const effectType = effect.type;
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