// src/services/ValidationCache.ts
/**
 * VALIDATION CACHE SYSTEM (January 2025)
 * =====================================
 * 
 * 🎯 INSTANT FRONTEND VALIDATION: Pre-computed card placement validations
 * 
 * This system pre-calculates and caches all possible card validations to provide
 * instant responses to the frontend without any computation delay.
 * 
 * KEY FEATURES:
 * ✅ Instant Lookup: O(1) validation checks for frontend
 * ✅ Pre-computed Actions: Available actions cached per player
 * ✅ Zone Validation: Card-zone compatibility pre-calculated
 * ✅ Smart Invalidation: Selective cache invalidation when effects change
 * ✅ Frontend Optimization: Structured data ready for UI consumption
 */

import { 
    GameEnvironment, 
    Player, 
    ValidationResult,
    ZoneType 
} from '../models/GameEnvironment';

// Define local interfaces since ValidationState interfaces were removed
interface PlayerRestrictions {
    playerId: string;
    zoneRestrictions: {
        [zone in ZoneType]?: string[] | 'ALL';
    };
    specialEffects: {
        zonePlacementFreedom?: boolean;
        immuneToNeutralization?: boolean;
        canPlayMultipleCards?: boolean;
    };
    disabledCards: Set<string>;
    calculatedPowers: Map<string, number>;
    placementValidations: Map<string, Map<ZoneType, boolean>>;
}

interface AvailableAction {
    type: 'PLAY_CARD' | 'PLAY_CARD_FACE_DOWN';
    cardId: string;
    validZones: ZoneType[];
    restrictions: string[];
}

interface CardValidation {
    cardId: string;
    zones: Map<ZoneType, boolean>;
    restrictions: string[];
}

import { CardInfoUtils } from './CardInfoUtils';

interface PlayerValidationState {
    availableActions: AvailableAction[];
    validPlacements: Map<string, Map<ZoneType, boolean>>;
    lastUpdated: number;
}

interface CacheMetrics {
    hitCount: number;
    missCount: number;
    invalidationCount: number;
    lastInvalidation: number;
}

export class ValidationCache {
    private placementCache: Map<string, Map<string, Map<ZoneType, boolean>>> = new Map(); // playerId -> cardId -> zone -> canPlace
    private actionCache: Map<string, AvailableAction[]> = new Map(); // playerId -> available actions
    private restrictionCache: Map<string, any> = new Map(); // playerId -> cached restrictions
    private metrics: CacheMetrics = {
        hitCount: 0,
        missCount: 0,
        invalidationCount: 0,
        lastInvalidation: 0
    };
    private cardInfoUtils: any = null;

    /**
     * Set CardInfoUtils dependency
     */
    public setCardInfoUtils(cardInfoUtils: any): void {
        this.cardInfoUtils = cardInfoUtils;
    }

    /**
     * Pre-compute all validations for a player
     * Called after effect changes to rebuild cache
     */
    public async precomputeValidations(gameEnv: GameEnvironment, playerId: string): Promise<void> {
        console.log(`🔄 Pre-computing validations for player ${playerId}...`);
        
        const player = gameEnv.players[playerId];
        if (!player) {
            console.log(`   ⚠️ Player ${playerId} not found`);
            return;
        }

        const availableActions: AvailableAction[] = [];
        const cardValidations = new Map<string, Map<ZoneType, boolean>>();
        
        // Get player restrictions from fieldEffects (single source of truth)
        const playerFieldEffects = gameEnv.fieldEffects[playerId];
        if (!playerFieldEffects) {
            console.log(`   ⚠️ No field effects found for player ${playerId}`);
            return;
        }
        
        // Convert fieldEffects to PlayerRestrictions format for compatibility
        const restrictions: PlayerRestrictions = {
            playerId,
            zoneRestrictions: playerFieldEffects.zoneRestrictions || {},
            specialEffects: {
                zonePlacementFreedom: playerFieldEffects.specialEffects?.zonePlacementFreedom || false,
                immuneToNeutralization: playerFieldEffects.specialEffects?.immuneToNeutralization || false,
                canPlayMultipleCards: false
            },
            disabledCards: new Set(playerFieldEffects.disabledCards || []),
            calculatedPowers: new Map(Object.entries(playerFieldEffects.calculatedPowers || {})),
            placementValidations: new Map()
        };

        // Pre-validate each card in hand for all zones
        for (const cardId of player.deck.hand) {
            const cardZoneValidations = new Map<ZoneType, boolean>();
            const validZones: ZoneType[] = [];
            
            for (const zone of Object.values(ZoneType)) {
                const canPlace = await this.validateCardZone(gameEnv, playerId, cardId, zone, restrictions);
                cardZoneValidations.set(zone, canPlace);
                
                if (canPlace) {
                    validZones.push(zone);
                }
            }
            
            cardValidations.set(cardId, cardZoneValidations);
            
            // Create available actions for valid placements
            if (validZones.length > 0) {
                // Face-up placement
                availableActions.push({
                    type: 'PLAY_CARD',
                    cardId,
                    validZones: validZones,
                    restrictions: []
                });
                
                // Face-down placement (usually allowed in most zones)
                const faceDownZones = await this.getFaceDownValidZones(gameEnv, playerId, cardId);
                if (faceDownZones.length > 0) {
                    availableActions.push({
                        type: 'PLAY_CARD_FACE_DOWN',
                        cardId,
                        validZones: faceDownZones,
                        restrictions: []
                    });
                }
            }
        }
        
        // Cache results for instant frontend access
        this.placementCache.set(playerId, cardValidations);
        this.actionCache.set(playerId, availableActions);
        this.restrictionCache.set(playerId, {
            zoneRestrictions: restrictions.zoneRestrictions,
            specialEffects: restrictions.specialEffects,
            disabledCards: Array.from(restrictions.disabledCards),
            lastUpdated: Date.now()
        });
        
        console.log(`   ✅ Pre-computed ${cardValidations.size} card validations and ${availableActions.length} actions`);
    }

    /**
     * Validate if a card can be placed in a specific zone
     */
    private async validateCardZone(
        gameEnv: GameEnvironment, 
        playerId: string, 
        cardId: string, 
        zone: ZoneType,
        restrictions: PlayerRestrictions
    ): Promise<boolean> {
        try {
            // Check if zone is occupied
            if (gameEnv.isZoneOccupied(playerId, zone)) {
                return false;
            }

            // Check if card is disabled
            if (restrictions.disabledCards.has(cardId)) {
                return false;
            }

            // Get card details
            const cardDetails = await this.cardInfoUtils.getCardDetails(cardId);
            if (!cardDetails) {
                return false;
            }

            // Check special effects (zone placement freedom bypasses restrictions)
            if (restrictions.specialEffects.zonePlacementFreedom) {
                return true;
            }

            // Check zone restrictions
            const allowedTypes = restrictions.zoneRestrictions[zone];
            if (!allowedTypes || allowedTypes === 'ALL') {
                return true;
            }

            // Validate card type against zone restrictions
            if (Array.isArray(allowedTypes)) {
                return allowedTypes.includes(cardDetails.gameType);
            }

            return false;
            
        } catch (error) {
            console.error(`❌ Error validating card ${cardId} in zone ${zone}:`, error);
            return false;
        }
    }

    /**
     * Get valid zones for face-down card placement
     */
    private async getFaceDownValidZones(gameEnv: GameEnvironment, playerId: string, cardId: string): Promise<ZoneType[]> {
        const validZones: ZoneType[] = [];
        
        // Face-down cards can usually be placed in any unoccupied zone
        // Check current game phase for restrictions
        const currentPhase = gameEnv.phase;
        
        for (const zone of Object.values(ZoneType)) {
            if (zone === ZoneType.LEADER) continue; // Leaders cannot be face-down
            
            // Check if zone is occupied
            if (!gameEnv.isZoneOccupied(playerId, zone)) {
                // Phase-specific restrictions
                if (currentPhase === 'SP_PHASE' && zone === ZoneType.SP) {
                    validZones.push(zone);
                } else if (currentPhase === 'MAIN_PHASE' && zone !== ZoneType.SP) {
                    validZones.push(zone);
                } else if (currentPhase !== 'SP_PHASE' && currentPhase !== 'MAIN_PHASE') {
                    // Other phases - allow most zones
                    validZones.push(zone);
                }
            }
        }
        
        return validZones;
    }

    /**
     * INSTANT LOOKUP - Get valid zones for a card (O(1))
     */
    public getValidZones(playerId: string, cardId: string): ZoneType[] {
        const playerCache = this.placementCache.get(playerId);
        if (!playerCache) {
            this.metrics.missCount++;
            return [];
        }
        
        const cardCache = playerCache.get(cardId);
        if (!cardCache) {
            this.metrics.missCount++;
            return [];
        }
        
        const validZones: ZoneType[] = [];
        for (const [zone, canPlace] of cardCache) {
            if (canPlace) validZones.push(zone);
        }
        
        this.metrics.hitCount++;
        return validZones;
    }

    /**
     * INSTANT LOOKUP - Check if card can be placed in zone (O(1))
     */
    public canPlaceCard(playerId: string, cardId: string, zone: ZoneType): boolean {
        const playerCache = this.placementCache.get(playerId);
        if (!playerCache) {
            this.metrics.missCount++;
            return false;
        }
        
        const cardCache = playerCache.get(cardId);
        if (!cardCache) {
            this.metrics.missCount++;
            return false;
        }
        
        const canPlace = cardCache.get(zone);
        if (canPlace === undefined) {
            this.metrics.missCount++;
            return false;
        }
        
        this.metrics.hitCount++;
        return canPlace;
    }

    /**
     * INSTANT LOOKUP - Get available actions for player (O(1))
     */
    public getAvailableActions(playerId: string): AvailableAction[] {
        const actions = this.actionCache.get(playerId);
        if (!actions) {
            this.metrics.missCount++;
            return [];
        }
        
        this.metrics.hitCount++;
        return actions;
    }

    /**
     * INSTANT FRONTEND API RESPONSE
     */
    public getPlayerValidationState(playerId: string): PlayerValidationState {
        return {
            availableActions: this.getAvailableActions(playerId),
            validPlacements: this.placementCache.get(playerId) || new Map(),
            lastUpdated: Date.now()
        };
    }

    /**
     * Invalidate cache for specific player
     * Called when effects change for this player
     */
    public invalidatePlayer(playerId: string): void {
        console.log(`🔄 Invalidating cache for player ${playerId}`);
        
        this.placementCache.delete(playerId);
        this.actionCache.delete(playerId);
        this.restrictionCache.delete(playerId);
        
        this.metrics.invalidationCount++;
        this.metrics.lastInvalidation = Date.now();
    }

    /**
     * Invalidate cache for specific card
     * Called when a card's status changes
     */
    public invalidateCard(playerId: string, cardId: string): void {
        console.log(`🔄 Invalidating cache for card ${cardId} of player ${playerId}`);
        
        const playerCache = this.placementCache.get(playerId);
        if (playerCache) {
            playerCache.delete(cardId);
        }
        
        // Remove actions for this card
        const actions = this.actionCache.get(playerId);
        if (actions) {
            const filteredActions = actions.filter(action => action.cardId !== cardId);
            this.actionCache.set(playerId, filteredActions);
        }
        
        this.metrics.invalidationCount++;
        this.metrics.lastInvalidation = Date.now();
    }

    /**
     * Invalidate cache for specific zone
     * Called when zone restrictions change
     */
    public invalidateZone(playerId: string, zone: ZoneType): void {
        console.log(`🔄 Invalidating cache for zone ${zone} of player ${playerId}`);
        
        const playerCache = this.placementCache.get(playerId);
        if (playerCache) {
            // Invalidate all cards for this zone
            for (const [cardId, cardCache] of playerCache) {
                cardCache.delete(zone);
            }
        }
        
        this.metrics.invalidationCount++;
        this.metrics.lastInvalidation = Date.now();
    }

    /**
     * Complete cache refresh for all players
     * Called after major game state changes
     */
    public async refreshAllCaches(gameEnv: GameEnvironment): Promise<void> {
        console.log('🔄 Refreshing all validation caches...');
        
        this.clearAllCaches();
        
        // Rebuild cache for all players
        for (const playerId of Object.keys(gameEnv.players)) {
            await this.precomputeValidations(gameEnv, playerId);
        }
        
        console.log('✅ All validation caches refreshed');
    }

    /**
     * Clear all caches
     */
    public clearAllCaches(): void {
        this.placementCache.clear();
        this.actionCache.clear();
        this.restrictionCache.clear();
        
        this.metrics.invalidationCount++;
        this.metrics.lastInvalidation = Date.now();
    }

    /**
     * Get cache performance metrics
     */
    public getMetrics(): CacheMetrics & { hitRate: number; cacheSize: number } {
        const totalRequests = this.metrics.hitCount + this.metrics.missCount;
        const hitRate = totalRequests > 0 ? (this.metrics.hitCount / totalRequests) * 100 : 0;
        
        return {
            ...this.metrics,
            hitRate: Math.round(hitRate * 100) / 100,
            cacheSize: this.placementCache.size
        };
    }

    /**
     * Export cache state for debugging
     */
    public exportCacheState(): any {
        const cacheState: any = {};
        
        for (const [playerId, playerCache] of this.placementCache) {
            cacheState[playerId] = {};
            for (const [cardId, cardCache] of playerCache) {
                cacheState[playerId][cardId] = Object.fromEntries(cardCache);
            }
        }
        
        return {
            placementCache: cacheState,
            availableActions: Object.fromEntries(this.actionCache),
            restrictions: Object.fromEntries(this.restrictionCache),
            metrics: this.getMetrics()
        };
    }
}

// Export singleton instance
export const validationCache = new ValidationCache();