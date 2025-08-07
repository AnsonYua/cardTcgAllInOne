"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizedGameEngineManager = exports.OptimizedGameEngine = void 0;
const GameEnvironment_1 = require("../models/GameEnvironment");
const IncrementalEffectManager_1 = require("./IncrementalEffectManager");
const ValidationCache_1 = require("./ValidationCache");
const CardInfoUtils_1 = require("./CardInfoUtils");
class OptimizedGameEngine {
    constructor(config) {
        this.cardInfoUtils = null;
        this.initialized = false;
        this.config = Object.assign({ enableCaching: true, enableMetrics: true, maxCacheSize: 1000, validationTimeout: 5000 }, config);
        this.metrics = {
            cardPlaysProcessed: 0,
            averageProcessingTime: 0,
            cacheHitRate: 0,
            totalValidationTime: 0,
            lastOperationTime: 0
        };
        this.incrementalManager = IncrementalEffectManager_1.incrementalEffectManager;
        this.validationCache = ValidationCache_1.validationCache;
        console.log('🚀 OptimizedGameEngine initialized with config:', this.config);
    }
    /**
     * Initialize with dependencies
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Initializing OptimizedGameEngine...');
            // Initialize CardInfoUtils (ready to use immediately after construction)
            this.cardInfoUtils = new CardInfoUtils_1.CardInfoUtils();
            // Set dependencies
            this.incrementalManager.setCardInfoUtils(this.cardInfoUtils);
            this.validationCache.setCardInfoUtils(this.cardInfoUtils);
            this.initialized = true;
            console.log('✅ OptimizedGameEngine initialized');
        });
    }
    /**
     * Check if this engine instance is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * MAIN CARD PLAY METHOD - Optimized O(1) processing
     */
    playCard(gameEnv_1, playerId_3, cardId_1, zone_1) {
        return __awaiter(this, arguments, void 0, function* (gameEnv, playerId, cardId, zone, faceDown = false) {
            const startTime = Date.now();
            console.log(`🎮 Playing card ${cardId} in ${zone} (faceDown: ${faceDown}) by ${playerId}`);
            try {
                // STEP 0: TURN AUTHORIZATION - Check if it's player's turn
                const turnCheck = yield this.checkIsPlayOkForAction(gameEnv, playerId);
                if (!turnCheck) {
                    this.addErrorEvent(gameEnv, 'TURN_ERROR', 'Not your turn', playerId);
                    return {
                        success: false,
                        error: 'Not your turn'
                    };
                }
                // STEP 1: INSTANT VALIDATION - No simulation needed
                const validation = yield this.validateCardPlayInstant(gameEnv, playerId, cardId, zone, faceDown);
                if (!validation.isValid) {
                    this.addErrorEvent(gameEnv, 'VALIDATION_ERROR', validation.error, playerId);
                    return {
                        success: false,
                        error: validation.error
                    };
                }
                // STEP 2: EXECUTE CARD PLAY - Update game state
                const playAction = yield this.executeCardPlay(gameEnv, playerId, cardId, zone, faceDown);
                // STEP 3: ADD GAME EVENTS - Frontend integration
                this.addSuccessEvents(gameEnv, playerId, cardId, zone, faceDown);
                // STEP 4: INCREMENTAL PROCESSING - Only process new effects
                yield this.incrementalManager.processNewEffects(gameEnv);
                // STEP 5: HANDLE CARD EFFECTS - Check for search effects requiring player selection
                const effectResult = yield this.processCardEffects(gameEnv, playerId, cardId);
                if (effectResult === null || effectResult === void 0 ? void 0 : effectResult.requiresCardSelection) {
                    return {
                        success: true,
                        gameState: gameEnv,
                        requiresCardSelection: true
                    };
                }
                // STEP 6: TURN MANAGEMENT - Check if turn should end and switch players
                const turnResult = yield this.shouldUpdateTurn(gameEnv, playerId);
                if (turnResult.turnSwitched) {
                    this.addGameEvent(gameEnv, GameEnvironment_1.EventType.TURN_SWITCH, {
                        oldPlayer: playerId,
                        newPlayer: gameEnv.currentPlayer,
                        turn: gameEnv.currentTurn
                    });
                }
                // STEP 7: PHASE MANAGEMENT - Check if phase should advance
                yield this.checkPhaseProgression(gameEnv);
                // STEP 8: UPDATE VALIDATION CACHE - Keep frontend data fresh
                if (this.config.enableCaching) {
                    yield this.updateValidationCaches(gameEnv, playAction);
                }
                // STEP 9: UPDATE METRICS
                if (this.config.enableMetrics) {
                    this.updateMetrics(startTime);
                }
                console.log(`✅ Card play completed in ${Date.now() - startTime}ms`);
                return {
                    success: true,
                    gameState: gameEnv,
                    processingTime: Date.now() - startTime
                };
            }
            catch (error) {
                console.error(`❌ Error in card play:`, error);
                this.addErrorEvent(gameEnv, 'INTERNAL_ERROR', `Internal error: ${(error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'}`, playerId);
                return {
                    success: false,
                    error: `Internal error: ${(error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'}`
                };
            }
        });
    }
    /**
     * INSTANT VALIDATION - No simulation required (O(1))
     */
    validateCardPlayInstant(gameEnv, playerId, cardId, zone, faceDown) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if player exists
            const player = gameEnv.players[playerId];
            if (!player) {
                console.log("validateCardPlayInstant Player not found");
                return { isValid: false, error: 'Player not found' };
            }
            // Check if card is in player's hand
            if (!player.deck.hand.includes(cardId)) {
                console.log(cardId);
                console.log(JSON.stringify(player.deck.hand));
                console.log("validateCardPlayInstant Card not in hand");
                return { isValid: false, error: 'Card not in hand' };
            }
            // Check if zone is occupied
            if (gameEnv.isZoneOccupied(playerId, zone)) {
                console.log(`Zone ${zone} is already occupied`);
                return { isValid: false, error: `Zone ${zone} is already occupied` };
            }
            // Get player field effects (single source of truth) or initialize if missing
            let playerFieldEffects = gameEnv.fieldEffects[playerId];
            if (!playerFieldEffects) {
                console.log('Player field effects not found, initializing...');
                // Initialize field effects for the player
                gameEnv.fieldEffects[playerId] = {
                    zoneRestrictions: {
                        top: 'ALL',
                        left: 'ALL',
                        right: 'ALL',
                        help: 'ALL',
                        sp: 'ALL'
                    },
                    activeEffects: [],
                    specialEffects: {},
                    calculatedPowers: {},
                    disabledCards: [],
                    victoryPointModifiers: 0
                };
                playerFieldEffects = gameEnv.fieldEffects[playerId];
            }
            // Face-down cards bypass most restrictions
            if (faceDown) {
                return yield this.validateFaceDownPlacement(gameEnv, playerId, zone);
            }
            console.log("card33444 ");
            // Check cached validation first
            if (this.config.enableCaching) {
                const canPlace = this.validationCache.canPlaceCard(playerId, cardId, zone);
                if (canPlace !== undefined) {
                    return { isValid: canPlace };
                }
            }
            console.log("card33444555 ");
            // Zone restrictions check using fieldEffects
            const allowedTypes = playerFieldEffects.zoneRestrictions && playerFieldEffects.zoneRestrictions[zone];
            if (allowedTypes && allowedTypes !== 'ALL') {
                const cardDetails = yield this.cardInfoUtils.getCardDetails(cardId);
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
            console.log("card33444555666 ");
            // Special effects check
            if (playerFieldEffects.specialEffects && playerFieldEffects.specialEffects.zonePlacementFreedom) {
                return { isValid: true }; // Freedom effect bypasses restrictions
            }
            console.log("card33444555666777 ");
            // Card-specific restrictions
            if (playerFieldEffects.disabledCards && playerFieldEffects.disabledCards.includes(cardId)) {
                return { isValid: false, error: 'Card is disabled' };
            }
            console.log("card33444555666777888 ");
            return { isValid: true };
        });
    }
    /**
     * Validate face-down card placement
     */
    validateFaceDownPlacement(gameEnv, playerId, zone) {
        return __awaiter(this, void 0, void 0, function* () {
            // Phase-specific restrictions for face-down cards
            const currentPhase = gameEnv.phase;
            if (currentPhase === 'SP_PHASE' && zone !== GameEnvironment_1.ZoneType.SP) {
                return {
                    isValid: false,
                    error: 'During SP_PHASE, cards can only be placed in SP zone'
                };
            }
            if (currentPhase === 'MAIN_PHASE' && zone === GameEnvironment_1.ZoneType.SP) {
                return {
                    isValid: false,
                    error: 'SP cards cannot be played during MAIN_PHASE'
                };
            }
            return { isValid: true };
        });
    }
    /**
     * Execute card play - Update game state
     */
    executeCardPlay(gameEnv, playerId, cardId, zone, faceDown) {
        return __awaiter(this, void 0, void 0, function* () {
            // Remove card from hand
            const player = gameEnv.players[playerId];
            const cardIndex = player.deck.hand.indexOf(cardId);
            if (cardIndex !== -1) {
                player.deck.hand.splice(cardIndex, 1);
            }
            // Place card in zone
            gameEnv.placeCardInZone(playerId, zone, cardId, faceDown);
            // Create play sequence action
            const playAction = {
                sequenceId: gameEnv.playSequenceManager.getNextSequenceId(),
                playerId,
                cardId,
                action: faceDown ? GameEnvironment_1.ActionType.PLAY_CARD_BACK : GameEnvironment_1.ActionType.PLAY_CARD,
                zone,
                isFaceDown: faceDown,
                effectData: {}
            };
            // Record in play sequence
            gameEnv.playSequenceManager.recordAction(playAction);
            // Generate game event
            gameEnv.eventManager.addEvent(GameEnvironment_1.EventType.CARD_PLAYED, {
                playerId,
                cardId,
                zone,
                faceDown,
                sequenceId: playAction.sequenceId
            });
            console.log(`   📝 Recorded play action: ${playAction.action} ${cardId} in ${zone}`);
            return playAction;
        });
    }
    /**
     * Update validation caches after card play
     */
    updateValidationCaches(gameEnv, playAction) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Updating validation caches...');
            // Invalidate affected caches
            this.validationCache.invalidatePlayer(playAction.playerId);
            // If card affects opponent, invalidate their cache too
            const cardDetails = yield this.cardInfoUtils.getCardDetails(playAction.cardId);
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
            yield this.validationCache.precomputeValidations(gameEnv, playAction.playerId);
            console.log('✅ Validation caches updated');
        });
    }
    /**
     * Initialize game for optimized processing
     */
    initializeGame(gameEnv) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Initializing game for optimized processing...');
            // Process existing play sequence
            yield this.incrementalManager.processNewEffects(gameEnv);
            // Build initial validation caches
            if (this.config.enableCaching) {
                for (const playerId of Object.keys(gameEnv.players)) {
                    yield this.validationCache.precomputeValidations(gameEnv, playerId);
                }
            }
            console.log('✅ Game initialized for optimized processing');
        });
    }
    /**
     * Get available actions for player (instant response)
     */
    getAvailableActions(gameEnv, playerId) {
        if (this.config.enableCaching) {
            return this.validationCache.getAvailableActions(playerId);
        }
        // Fallback to real-time calculation (slower)
        return this.calculateAvailableActionsRealtime(gameEnv, playerId);
    }
    /**
     * Calculate available actions in real-time (fallback)
     */
    calculateAvailableActionsRealtime(gameEnv, playerId) {
        const actions = [];
        const player = gameEnv.players[playerId];
        if (!player)
            return actions;
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
    getValidZonesRealtime(gameEnv, playerId, cardId) {
        if (this.config.enableCaching) {
            return this.validationCache.getValidZones(playerId, cardId);
        }
        // Fallback implementation using fieldEffects
        const validZones = [];
        const playerFieldEffects = gameEnv.fieldEffects[playerId];
        if (!playerFieldEffects)
            return validZones;
        for (const zone of Object.values(GameEnvironment_1.ZoneType)) {
            if (!gameEnv.isZoneOccupied(playerId, zone)) {
                // Simplified validation - could be expanded
                validZones.push(zone);
            }
        }
        return validZones;
    }
    /**
     * Check if action is allowed for player (turn authorization)
     */
    checkIsPlayOkForAction(gameEnv, playerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if it's player's turn
            return gameEnv.currentPlayer === playerId;
        });
    }
    /**
     * Add game event for frontend integration
     */
    addGameEvent(gameEnv, eventType, eventData = {}) {
        if (!gameEnv.gameEvents)
            gameEnv.gameEvents = [];
        if (!gameEnv.lastEventId)
            gameEnv.lastEventId = 0;
        const eventId = `event_${Date.now()}_${++gameEnv.lastEventId}`;
        const event = {
            id: eventId,
            type: eventType,
            data: eventData,
            timestamp: Date.now(),
            expiresAt: Date.now() + 3000, // 3 seconds
            frontendProcessed: false,
            requireFrontendAcknowledgment: false
        };
        gameEnv.gameEvents.push(event);
        console.log(`🎯 Event added: ${eventType} (ID: ${eventId})`);
    }
    /**
     * Add error event for frontend integration
     */
    addErrorEvent(gameEnv, errorType, errorMessage, playerId) {
        this.addGameEvent(gameEnv, 'ERROR_OCCURRED', {
            errorType,
            message: errorMessage,
            playerId,
            timestamp: Date.now()
        });
    }
    /**
     * Add success events for card placement
     */
    addSuccessEvents(gameEnv, playerId, cardId, zone, faceDown) {
        // Get card details for event
        const cardDetails = this.getCardDetails(cardId);
        // Add CARD_PLAYED event
        this.addGameEvent(gameEnv, 'CARD_PLAYED', {
            playerId,
            card: {
                cardId: (cardDetails === null || cardDetails === void 0 ? void 0 : cardDetails.id) || cardId,
                name: (cardDetails === null || cardDetails === void 0 ? void 0 : cardDetails.name) || 'Unknown Card',
                cardType: (cardDetails === null || cardDetails === void 0 ? void 0 : cardDetails.cardType) || 'unknown',
                power: (cardDetails === null || cardDetails === void 0 ? void 0 : cardDetails.power) || 0,
                gameType: (cardDetails === null || cardDetails === void 0 ? void 0 : cardDetails.gameType) || 'unknown',
                traits: (cardDetails === null || cardDetails === void 0 ? void 0 : cardDetails.traits) || []
            },
            zone: zone.toLowerCase(),
            isFaceDown: faceDown,
            timestamp: Date.now()
        });
        // Add ZONE_FILLED event
        this.addGameEvent(gameEnv, 'ZONE_FILLED', {
            playerId,
            zone: zone.toLowerCase(),
            cardCount: 1,
            timestamp: Date.now()
        });
    }
    /**
     * Process card effects (placeholder for search effects)
     */
    processCardEffects(gameEnv, playerId, cardId) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement card effect processing for search effects
            // For now, return null to indicate no special handling needed
            return null;
        });
    }
    /**
     * Check if turn should update and switch players
     */
    shouldUpdateTurn(gameEnv, playerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Card placement always ends turn in this game
            const opponentId = this.getOpponentId(gameEnv, playerId);
            // Switch to opponent
            gameEnv.currentPlayer = opponentId;
            gameEnv.currentTurn = (gameEnv.currentTurn || 0) + 1;
            gameEnv.phase = 'DRAW_PHASE'; // Next player enters draw phase
            // Draw card for new current player
            this.drawCardForPlayer(gameEnv, opponentId);
            return { turnSwitched: true };
        });
    }
    /**
     * Check if phase should progress (main -> SP -> battle)
     */
    checkPhaseProgression(gameEnv) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if all main zones filled
            const allMainZonesFilled = this.areAllMainZonesFilled(gameEnv);
            if (allMainZonesFilled && gameEnv.phase === 'MAIN_PHASE') {
                this.addGameEvent(gameEnv, 'ALL_MAIN_ZONES_FILLED', {
                    message: 'All character and help zones filled, advancing to SP phase'
                });
                // Advance to SP phase
                gameEnv.phase = 'SP_PHASE';
                this.addGameEvent(gameEnv, 'PHASE_CHANGE', {
                    oldPhase: 'MAIN_PHASE',
                    newPhase: 'SP_PHASE',
                    reason: 'All main zones filled'
                });
            }
        });
    }
    /**
     * Check if all main zones are filled for both players
     */
    areAllMainZonesFilled(gameEnv) {
        var _a, _b, _c, _d;
        const players = [gameEnv.playerId_1, gameEnv.playerId_2].filter(Boolean);
        for (const playerId of players) {
            const playerZones = gameEnv.zones.getPlayerZones(playerId);
            if (!playerZones)
                return false;
            // Check character zones (top, left, right)
            if (!((_a = playerZones.top) === null || _a === void 0 ? void 0 : _a.length) || !((_b = playerZones.left) === null || _b === void 0 ? void 0 : _b.length) || !((_c = playerZones.right) === null || _c === void 0 ? void 0 : _c.length)) {
                return false;
            }
            // Check help zone
            if (!((_d = playerZones.help) === null || _d === void 0 ? void 0 : _d.length)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Draw card for player
     */
    drawCardForPlayer(gameEnv, playerId) {
        const player = gameEnv.players[playerId];
        if (!player || !player.deck.mainDeck.length)
            return;
        // Move card from deck to hand
        const drawnCard = player.deck.mainDeck.shift();
        if (drawnCard) {
            player.deck.hand.push(drawnCard);
            this.addGameEvent(gameEnv, 'CARD_DRAWN', {
                playerId,
                handSize: player.deck.hand.length
            });
        }
    }
    /**
     * Get card details (placeholder - should integrate with CardInfoUtils)
     */
    getCardDetails(cardId) {
        // TODO: Integrate with CardInfoUtils to get proper card details
        // For now, return basic structure
        const baseId = cardId.split('_')[0];
        return {
            id: baseId,
            name: `Card ${baseId}`,
            cardType: 'character',
            gameType: 'unknown',
            power: 100,
            traits: []
        };
    }
    /**
     * Get opponent player ID
     */
    getOpponentId(gameEnv, playerId) {
        return playerId === gameEnv.playerId_1 ? gameEnv.playerId_2 : gameEnv.playerId_1;
    }
    /**
     * Update performance metrics
     */
    updateMetrics(startTime) {
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
    getPerformanceMetrics() {
        return Object.assign(Object.assign({}, this.metrics), { incrementalManagerMetrics: this.incrementalManager.getMetrics(), cacheMetrics: this.config.enableCaching ? this.validationCache.getMetrics() : null });
    }
    /**
     * Reset performance metrics
     */
    resetMetrics() {
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
    exportOptimizedGameState(gameEnv) {
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
    exportValidationState(gameEnv) {
        const validation = {};
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
    exportCardPlacements(playerId) {
        const playerValidationState = this.validationCache.getPlayerValidationState(playerId);
        const placements = {};
        for (const [cardId, zoneMap] of playerValidationState.validPlacements) {
            placements[cardId] = Object.fromEntries(zoneMap);
        }
        return placements;
    }
    /**
     * Cleanup and dispose resources
     */
    dispose() {
        console.log('🔄 Disposing OptimizedGameEngine...');
        if (this.config.enableCaching) {
            this.validationCache.clearAllCaches();
        }
        this.resetMetrics();
        console.log('✅ OptimizedGameEngine disposed');
    }
}
exports.OptimizedGameEngine = OptimizedGameEngine;
// OptimizedGameEngine class exported automatically with 'export class' declaration above
// Game Engine Manager - Handles multiple concurrent games
class OptimizedGameEngineManager {
    constructor() {
        this.gameEngines = new Map();
    }
    /**
     * Get or create a game engine for a specific game
     */
    getGameEngine(gameId) {
        if (!this.gameEngines.has(gameId)) {
            console.log(`🚀 Creating new OptimizedGameEngine for game: ${gameId}`);
            this.gameEngines.set(gameId, new OptimizedGameEngine());
        }
        return this.gameEngines.get(gameId);
    }
    /**
     * Initialize a game engine for a specific game
     */
    initializeGameEngine(gameId) {
        return __awaiter(this, void 0, void 0, function* () {
            const engine = this.getGameEngine(gameId);
            if (!engine.isInitialized()) {
                yield engine.initialize();
                console.log(`✅ OptimizedGameEngine initialized for game: ${gameId}`);
            }
        });
    }
    /**
     * Remove game engine when game ends
     */
    removeGameEngine(gameId) {
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
    getGlobalMetrics() {
        const metrics = {
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
exports.optimizedGameEngineManager = new OptimizedGameEngineManager();
