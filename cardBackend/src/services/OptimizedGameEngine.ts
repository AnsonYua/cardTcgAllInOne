// src/services/OptimizedGameEngine.ts
/**
 * OPTIMIZED GAME ENGINE (January 2025)
 * ====================================
 * 
 * 🎯 HIGH-PERFORMANCE CARD PLAY SYSTEM: O(1) processing with frontend optimization
 * 
 * This system replaces the O(n²) full replay simulation with incremental processing,
 * providing massive performance improvements while maintaining all validation features.
 * 
 * KEY FEATURES:
 * ✅ Incremental Processing: Only new effects processed per card play
 * ✅ Instant Validation: Pre-computed validations for immediate frontend response
 * ✅ Effect Caching: Smart caching with selective invalidation
 * ✅ Backward Compatibility: Works with existing API and frontend expectations
 * ✅ Performance Monitoring: Built-in metrics and profiling
 */

import { 
    GameEnvironment, 
    Player, 
    GameResult,
    ValidationResult,
    ZoneType,
    PlaySequenceAction,
    ActionType,
    EventType
} from '../models/GameEnvironment';

// Define local interfaces since removed from GameEnvironment
interface AvailableAction {
    type: 'PLAY_CARD' | 'PLAY_CARD_FACE_DOWN';
    cardId: string;
    validZones: ZoneType[];
    restrictions: string[];
}

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

import { IncrementalEffectManager, incrementalEffectManager } from './IncrementalEffectManager';
import { ValidationCache, validationCache } from './ValidationCache';
import { CardInfoUtils } from './CardInfoUtils';

interface OptimizedGameConfig {
    enableCaching: boolean;
    enableMetrics: boolean;
    maxCacheSize: number;
    validationTimeout: number;
}

interface PerformanceMetrics {
    cardPlaysProcessed: number;
    averageProcessingTime: number;
    cacheHitRate: number;
    totalValidationTime: number;
    lastOperationTime: number;
}

export class OptimizedGameEngine {
    private config: OptimizedGameConfig;
    private metrics: PerformanceMetrics;
    private incrementalManager: IncrementalEffectManager;
    private validationCache: ValidationCache;
    private cardInfoUtils: any = null;
    private initialized: boolean = false;

    constructor(config?: Partial<OptimizedGameConfig>) {
        this.config = {
            enableCaching: true,
            enableMetrics: true,
            maxCacheSize: 1000,
            validationTimeout: 5000,
            ...config
        };

        this.metrics = {
            cardPlaysProcessed: 0,
            averageProcessingTime: 0,
            cacheHitRate: 0,
            totalValidationTime: 0,
            lastOperationTime: 0
        };

        this.incrementalManager = incrementalEffectManager;
        this.validationCache = validationCache;

        console.log('🚀 OptimizedGameEngine initialized with config:', this.config);
    }

    /**
     * Initialize with dependencies
     */
    public async initialize(): Promise<void> {
        console.log('🔄 Initializing OptimizedGameEngine...');
        
        // Initialize CardInfoUtils (ready to use immediately after construction)
        this.cardInfoUtils = new CardInfoUtils();
        
        // Set dependencies
        this.incrementalManager.setCardInfoUtils(this.cardInfoUtils);
        this.validationCache.setCardInfoUtils(this.cardInfoUtils);
        
        this.initialized = true;
        console.log('✅ OptimizedGameEngine initialized');
    }

    /**
     * Check if this engine instance is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * MAIN CARD PLAY METHOD - Optimized O(1) processing
     */
    public async playCard(
        gameEnv: GameEnvironment, 
        playerId: string, 
        cardId: string, 
        zone: ZoneType, 
        faceDown: boolean = false
    ): Promise<GameResult> {
        const startTime = Date.now();
        console.log(`🎮 Playing card ${cardId} in ${zone} (faceDown: ${faceDown}) by ${playerId}`);

        try {
            // STEP 1: INSTANT VALIDATION - No simulation needed
            const validation = await this.validateCardPlayInstant(gameEnv, playerId, cardId, zone, faceDown);
            if (!validation.isValid) {
                return { 
                    success: false, 
                    error: validation.error
                };
            }

            // STEP 2: EXECUTE CARD PLAY - Update game state
            const playAction = await this.executeCardPlay(gameEnv, playerId, cardId, zone, faceDown);

            // STEP 3: INCREMENTAL PROCESSING - Only process new effects
            await this.incrementalManager.processNewEffects(gameEnv);

            // STEP 4: UPDATE VALIDATION CACHE - Keep frontend data fresh
            if (this.config.enableCaching) {
                await this.updateValidationCaches(gameEnv, playAction);
            }

            // STEP 5: UPDATE METRICS
            if (this.config.enableMetrics) {
                this.updateMetrics(startTime);
            }

            console.log(`✅ Card play completed in ${Date.now() - startTime}ms`);

            return { 
                success: true, 
                gameState: gameEnv
            };

        } catch (error: any) {
            console.error(`❌ Error in card play:`, error);
            return { 
                success: false, 
                error: `Internal error: ${error?.message || 'Unknown error'}`
            };
        }
    }

    /**
     * INSTANT VALIDATION - No simulation required (O(1))
     */
    private async validateCardPlayInstant(
        gameEnv: GameEnvironment, 
        playerId: string, 
        cardId: string, 
        zone: ZoneType,
        faceDown: boolean
    ): Promise<ValidationResult> {
        
        // Check if player exists
        const player = gameEnv.players[playerId];
        if (!player) {
            return { isValid: false, error: 'Player not found' };
        }

        // Check if card is in player's hand
        if (!player.deck.hand.includes(cardId)) {
            return { isValid: false, error: 'Card not in hand' };
        }

        // Check if zone is occupied
        if (gameEnv.isZoneOccupied(playerId, zone)) {
            return { isValid: false, error: `Zone ${zone} is already occupied` };
        }

        // Get player field effects (single source of truth)
        const playerFieldEffects = gameEnv.fieldEffects[playerId];
        if (!playerFieldEffects) {
            return { isValid: false, error: 'Player field effects not found' };
        }

        // Face-down cards bypass most restrictions
        if (faceDown) {
            return await this.validateFaceDownPlacement(gameEnv, playerId, zone);
        }

        // Check cached validation first
        if (this.config.enableCaching) {
            const canPlace = this.validationCache.canPlaceCard(playerId, cardId, zone);
            if (canPlace !== undefined) {
                return { isValid: canPlace };
            }
        }

        // Zone restrictions check using fieldEffects
        const allowedTypes = playerFieldEffects.zoneRestrictions && playerFieldEffects.zoneRestrictions[zone];
        if (allowedTypes && allowedTypes !== 'ALL') {
            const cardDetails = await this.cardInfoUtils.getCardDetails(cardId);
            if (!cardDetails) {
                return { isValid: false, error: 'Card details not found' };
            }

            if (Array.isArray(allowedTypes) && !allowedTypes.includes(cardDetails.gameType)) {
                return { 
                    isValid: false, 
                    error: `Card type ${cardDetails.gameType} not allowed in ${zone}` 
                };
            }
        }

        // Special effects check
        if (playerFieldEffects.specialEffects && playerFieldEffects.specialEffects.zonePlacementFreedom) {
            return { isValid: true }; // Freedom effect bypasses restrictions
        }

        // Card-specific restrictions
        if (playerFieldEffects.disabledCards && playerFieldEffects.disabledCards.includes(cardId)) {
            return { isValid: false, error: 'Card is disabled' };
        }

        return { isValid: true };
    }

    /**
     * Validate face-down card placement
     */
    private async validateFaceDownPlacement(
        gameEnv: GameEnvironment, 
        playerId: string, 
        zone: ZoneType
    ): Promise<ValidationResult> {
        
        // Phase-specific restrictions for face-down cards
        const currentPhase = gameEnv.phase;
        
        if (currentPhase === 'SP_PHASE' && zone !== ZoneType.SP) {
            return { 
                isValid: false, 
                error: 'During SP_PHASE, cards can only be placed in SP zone' 
            };
        }

        if (currentPhase === 'MAIN_PHASE' && zone === ZoneType.SP) {
            return { 
                isValid: false, 
                error: 'SP cards cannot be played during MAIN_PHASE' 
            };
        }

        return { isValid: true };
    }

    /**
     * Execute card play - Update game state
     */
    private async executeCardPlay(
        gameEnv: GameEnvironment, 
        playerId: string, 
        cardId: string, 
        zone: ZoneType,
        faceDown: boolean
    ): Promise<PlaySequenceAction> {
        
        // Remove card from hand
        const player = gameEnv.players[playerId];
        const cardIndex = player.deck.hand.indexOf(cardId);
        if (cardIndex !== -1) {
            player.deck.hand.splice(cardIndex, 1);
        }

        // Place card in zone
        gameEnv.placeCardInZone(playerId, zone, cardId, faceDown);

        // Create play sequence action
        const playAction: PlaySequenceAction = {
            sequenceId: gameEnv.playSequenceManager.getNextSequenceId(),
            playerId,
            cardId,
            action: faceDown ? ActionType.PLAY_CARD_BACK : ActionType.PLAY_CARD,
            zone,
            isFaceDown: faceDown,
            effectData: {}
        };

        // Record in play sequence
        gameEnv.playSequenceManager.recordAction(playAction);

        // Generate game event
        gameEnv.eventManager.addEvent(EventType.CARD_PLAYED, {
            playerId,
            cardId,
            zone,
            faceDown,
            sequenceId: playAction.sequenceId
        });

        console.log(`   📝 Recorded play action: ${playAction.action} ${cardId} in ${zone}`);

        return playAction;
    }

    /**
     * Update validation caches after card play
     */
    private async updateValidationCaches(gameEnv: GameEnvironment, playAction: PlaySequenceAction): Promise<void> {
        console.log('🔄 Updating validation caches...');

        // Invalidate affected caches
        this.validationCache.invalidatePlayer(playAction.playerId);
        
        // If card affects opponent, invalidate their cache too
        const cardDetails = await this.cardInfoUtils.getCardDetails(playAction.cardId);
        if (cardDetails && cardDetails.effects && cardDetails.effects.rules) {
            for (const rule of cardDetails.effects.rules) {
                if (rule.target.scope === 'OPPONENT') {
                    const opponentId = this.getOpponentId(gameEnv, playAction.playerId);
                    this.validationCache.invalidatePlayer(opponentId);
                    break;
                }
            }
        }

        // Rebuild caches for affected players
        await this.validationCache.precomputeValidations(gameEnv, playAction.playerId);
        
        console.log('✅ Validation caches updated');
    }

    /**
     * Initialize game for optimized processing
     */
    public async initializeGame(gameEnv: GameEnvironment): Promise<void> {
        console.log('🔄 Initializing game for optimized processing...');

        // Process existing play sequence
        await this.incrementalManager.processNewEffects(gameEnv);

        // Build initial validation caches
        if (this.config.enableCaching) {
            for (const playerId of Object.keys(gameEnv.players)) {
                await this.validationCache.precomputeValidations(gameEnv, playerId);
            }
        }

        console.log('✅ Game initialized for optimized processing');
    }

    /**
     * Get available actions for player (instant response)
     */
    public getAvailableActions(gameEnv: GameEnvironment, playerId: string): AvailableAction[] {
        if (this.config.enableCaching) {
            return this.validationCache.getAvailableActions(playerId);
        }

        // Fallback to real-time calculation (slower)
        return this.calculateAvailableActionsRealtime(gameEnv, playerId);
    }

    /**
     * Calculate available actions in real-time (fallback)
     */
    private calculateAvailableActionsRealtime(gameEnv: GameEnvironment, playerId: string): AvailableAction[] {
        const actions: AvailableAction[] = [];
        const player = gameEnv.players[playerId];
        
        if (!player) return actions;

        for (const cardId of player.deck.hand) {
            const validZones = this.getValidZonesRealtime(gameEnv, playerId, cardId);
            
            if (validZones.length > 0) {
                actions.push({
                    type: 'PLAY_CARD',
                    cardId,
                    validZones,
                    restrictions: []
                });
            }
        }

        return actions;
    }

    /**
     * Get valid zones for card in real-time
     */
    private getValidZonesRealtime(gameEnv: GameEnvironment, playerId: string, cardId: string): ZoneType[] {
        if (this.config.enableCaching) {
            return this.validationCache.getValidZones(playerId, cardId);
        }

        // Fallback implementation using fieldEffects
        const validZones: ZoneType[] = [];
        const playerFieldEffects = gameEnv.fieldEffects[playerId];
        
        if (!playerFieldEffects) return validZones;

        for (const zone of Object.values(ZoneType)) {
            if (!gameEnv.isZoneOccupied(playerId, zone)) {
                // Simplified validation - could be expanded
                validZones.push(zone);
            }
        }

        return validZones;
    }

    /**
     * Get opponent player ID
     */
    private getOpponentId(gameEnv: GameEnvironment, playerId: string): string {
        return playerId === gameEnv.playerId_1 ? gameEnv.playerId_2! : gameEnv.playerId_1!;
    }

    /**
     * Update performance metrics
     */
    private updateMetrics(startTime: number): void {
        const processingTime = Date.now() - startTime;
        
        this.metrics.cardPlaysProcessed++;
        this.metrics.lastOperationTime = processingTime;
        
        // Update average processing time
        const totalTime = this.metrics.averageProcessingTime * (this.metrics.cardPlaysProcessed - 1) + processingTime;
        this.metrics.averageProcessingTime = totalTime / this.metrics.cardPlaysProcessed;
        
        // Update cache hit rate
        if (this.config.enableCaching) {
            const cacheMetrics = this.validationCache.getMetrics();
            this.metrics.cacheHitRate = cacheMetrics.hitRate;
        }
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(): PerformanceMetrics & {
        incrementalManagerMetrics: any;
        cacheMetrics: any;
    } {
        return {
            ...this.metrics,
            incrementalManagerMetrics: this.incrementalManager.getMetrics(),
            cacheMetrics: this.config.enableCaching ? this.validationCache.getMetrics() : null
        };
    }

    /**
     * Reset performance metrics
     */
    public resetMetrics(): void {
        this.metrics = {
            cardPlaysProcessed: 0,
            averageProcessingTime: 0,
            cacheHitRate: 0,
            totalValidationTime: 0,
            lastOperationTime: 0
        };
    }

    /**
     * Export optimized game state for API response
     */
    public exportOptimizedGameState(gameEnv: GameEnvironment): any {
        return {
            // Standard game data
            gameEnv: gameEnv.toJSON(),
            
            // FRONTEND-CRITICAL: Instant validation data
            validation: this.exportValidationState(gameEnv),
            
            // Performance metrics (optional)
            performance: this.config.enableMetrics ? {
                validationComputeTime: this.metrics.lastOperationTime,
                cacheHitRate: this.metrics.cacheHitRate,
                incrementalProcessingTime: this.metrics.averageProcessingTime
            } : undefined
        };
    }

    /**
     * Export validation state for frontend
     */
    private exportValidationState(gameEnv: GameEnvironment): any {
        const validation: any = {};
        
        for (const [playerId, fieldEffects] of Object.entries(gameEnv.fieldEffects)) {
            validation[playerId] = {
                zoneRestrictions: fieldEffects.zoneRestrictions,
                availableActions: this.getAvailableActions(gameEnv, playerId),
                cardPlacements: this.config.enableCaching ? 
                    this.exportCardPlacements(playerId) : {},
                specialEffects: fieldEffects.specialEffects,
                disabledCards: fieldEffects.disabledCards || [],
                calculatedPowers: fieldEffects.calculatedPowers || {}
            };
        }
        
        return validation;
    }

    /**
     * Export card placement validations
     */
    private exportCardPlacements(playerId: string): any {
        const playerValidationState = this.validationCache.getPlayerValidationState(playerId);
        const placements: any = {};
        
        for (const [cardId, zoneMap] of playerValidationState.validPlacements) {
            placements[cardId] = Object.fromEntries(zoneMap);
        }
        
        return placements;
    }

    /**
     * Cleanup and dispose resources
     */
    public dispose(): void {
        console.log('🔄 Disposing OptimizedGameEngine...');
        
        if (this.config.enableCaching) {
            this.validationCache.clearAllCaches();
        }
        
        this.resetMetrics();
        
        console.log('✅ OptimizedGameEngine disposed');
    }
}

// OptimizedGameEngine class exported automatically with 'export class' declaration above

// Game Engine Manager - Handles multiple concurrent games
class OptimizedGameEngineManager {
    private gameEngines: Map<string, OptimizedGameEngine> = new Map();
    
    /**
     * Get or create a game engine for a specific game
     */
    public getGameEngine(gameId: string): OptimizedGameEngine {
        if (!this.gameEngines.has(gameId)) {
            console.log(`🚀 Creating new OptimizedGameEngine for game: ${gameId}`);
            this.gameEngines.set(gameId, new OptimizedGameEngine());
        }
        return this.gameEngines.get(gameId)!;
    }
    
    /**
     * Initialize a game engine for a specific game
     */
    public async initializeGameEngine(gameId: string): Promise<void> {
        const engine = this.getGameEngine(gameId);
        if (!engine.isInitialized()) {
            await engine.initialize();
            console.log(`✅ OptimizedGameEngine initialized for game: ${gameId}`);
        }
    }
    
    /**
     * Remove game engine when game ends
     */
    public removeGameEngine(gameId: string): void {
        const engine = this.gameEngines.get(gameId);
        if (engine) {
            engine.dispose();
            this.gameEngines.delete(gameId);
            console.log(`🗑️ OptimizedGameEngine removed for game: ${gameId}`);
        }
    }
    
    /**
     * Get metrics for all active games
     */
    public getGlobalMetrics(): any {
        const metrics: any = {
            activeGames: this.gameEngines.size,
            gameEngines: {}
        };
        
        this.gameEngines.forEach((engine, gameId) => {
            metrics.gameEngines[gameId] = engine.getPerformanceMetrics();
        });
        
        return metrics;
    }
}

// Export singleton manager for handling multiple games
export const optimizedGameEngineManager = new OptimizedGameEngineManager();