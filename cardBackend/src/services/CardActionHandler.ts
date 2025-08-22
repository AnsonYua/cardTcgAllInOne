// =======================================================================================
// 🎯 CARD ACTION HANDLER - Clean Class Implementation for Card Placement Logic
// =======================================================================================
//
// This class handles ALL card placement and validation logic with clear switch-case routing.
// Extracted from the massive mozGamePlay.js for better maintainability.
//
// Key Features:
// - Comprehensive card placement validation with multi-layered checks
// - Face-down card mechanics with complete restriction bypass
// - Zone compatibility enforcement with leader restrictions
// - Phase-based placement rules (MAIN_PHASE vs SP_PHASE)
// - Card type validation (character, help, SP cards)
// - Immediate effect processing for character and help cards
// - Event generation for frontend synchronization
//
// Validation Layers:
// 1. Basic Validation: Position bounds, card index, card existence
// 2. Advanced Restrictions: Leader effects, card effects, zone compatibility
// 3. Phase Validation: Phase-specific rules for SP cards and face-down placement
// 4. Card Type Validation: Type-specific zone restrictions and occupancy rules
//
// Card Placement Flow:
// 1. validateBasicPlacement() - Position, hand index, card existence
// 2. validateAdvancedRestrictions() - Leader restrictions, field effects
// 3. validatePhaseRestrictions() - Phase-based rules for SP/face-down cards
// 4. validateCardTypeRestrictions() - Type-specific zone and occupancy rules
// 5. executeCardPlacement() - State update and field placement
// 6. processImmediateEffects() - Card effects and selection requirements
//
// =======================================================================================

import { ZoneMapping, ZoneName, CharacterZone } from '../../shared/utils/ZoneMapping';
const CardDataValidator = require('../utils/CardDataValidator');

// TurnPhase constants (defined inline in mozGamePlay.js)
enum TurnPhase {
    START_REDRAW = 'START_REDRAW',
    DRAW_PHASE = 'DRAW_PHASE',
    MAIN_PHASE = 'MAIN_PHASE',
    SP_PHASE = 'SP_PHASE',
    BATTLE_PHASE = 'BATTLE_PHASE',
    END_PHASE = 'END_PHASE',
    GAME_END = 'GAME_END'
}

// Interface for the mozGamePlay instance
interface MozGamePlay {
    getPlayerHand?: (playerId: string) => any[];
    setPlayerHand?: (playerId: string, hand: any[]) => void;
    getPlayerData?: (playerId: string) => any;
    monsterInField?: (playerId: string) => any;
    addGameEvent?: (gameEnv: any, eventType: any, data: any) => void;
    addErrorEvent?: (error: any) => void;
    throwError?: (message: string) => void;
    processCharacterSummonEffects?: (card: any, playerId: string, zone: string) => void;
    processUtilityCardEffects?: (card: any, playerId: string, zone: string) => void;
    gameEnv?: any;
}

// Card placement action interface
interface CardPlacementAction {
    type: 'PlayCard' | 'PlayCardBack';
    card_idx: number;
    field_idx: number;
    isFaceDown?: boolean;
}

// Validation result interface
interface ValidationResult {
    isValid: boolean;
    error?: string;
    details?: string;
}

/**
 * CardActionHandler - Manages card placement and validation logic
 * 
 * Responsibilities:
 * - Multi-layered card placement validation
 * - Face-down card mechanics and restrictions
 * - Zone compatibility and occupancy enforcement
 * - Phase-based placement rules
 * - Card type-specific validation
 * - Field state updates and action tracking
 * - Immediate effect processing
 */
export class CardActionHandler {
    private mozGamePlay: MozGamePlay;
    private getPlayerHand: (playerId: string) => any[];
    private setPlayerHand: (playerId: string, hand: any[]) => void;
    private getPlayerData: (playerId: string) => any;
    private monsterInField: (playerId: string) => any;
    private addGameEvent: (gameEnv: any, eventType: any, data: any) => void;
    private addErrorEvent: (error: any) => void;
    private throwError: (message: string) => void;
    private processCharacterSummonEffects: (card: any, playerId: string, zone: string) => void;
    private processUtilityCardEffects: (card: any, playerId: string, zone: string) => void;

    constructor(mozGamePlay: MozGamePlay) {
        this.mozGamePlay = mozGamePlay;
        
        // Bind required methods from mozGamePlay for clean delegation
        this.getPlayerHand = mozGamePlay.getPlayerHand?.bind(mozGamePlay) || (() => []);
        this.setPlayerHand = mozGamePlay.setPlayerHand?.bind(mozGamePlay) || (() => {});
        this.getPlayerData = mozGamePlay.getPlayerData?.bind(mozGamePlay) || (() => ({}));
        this.monsterInField = mozGamePlay.monsterInField?.bind(mozGamePlay) || (() => ({}));
        this.addGameEvent = mozGamePlay.addGameEvent?.bind(mozGamePlay) || (() => {});
        this.addErrorEvent = mozGamePlay.addErrorEvent?.bind(mozGamePlay) || (() => {});
        this.throwError = mozGamePlay.throwError?.bind(mozGamePlay) || (() => {});
        this.processCharacterSummonEffects = mozGamePlay.processCharacterSummonEffects?.bind(mozGamePlay) || (() => {});
        this.processUtilityCardEffects = mozGamePlay.processUtilityCardEffects?.bind(mozGamePlay) || (() => {});
    }

    /**
     * Main entry point for card placement actions
     * @param action - Card placement action
     * @param playerId - Player performing the action
     * @returns Success/failure result
     */
    public processCardPlacement(action: CardPlacementAction, playerId: string): ValidationResult {
        try {
            const gameEnv = this.mozGamePlay.gameEnv;
            if (!gameEnv) {
                return { isValid: false, error: 'Game environment not available' };
            }

            // Get zone name from field index
            const zoneName = ZoneMapping.getZoneFromIndex(action.field_idx);
            if (!zoneName) {
                return { isValid: false, error: `Invalid field index: ${action.field_idx}` };
            }

            // Determine if card is face-down
            const isFaceDown = action.type === 'PlayCardBack' || action.isFaceDown || false;

            // 1. Basic Validation
            const basicValidation = this.validateBasicPlacement(action, playerId, gameEnv);
            if (!basicValidation.isValid) {
                return basicValidation;
            }

            // Get the card being placed
            const playerHand = this.getPlayerHand(playerId);
            const card = playerHand[action.card_idx];

            // 2. Advanced Restrictions (skip for face-down cards)
            if (!isFaceDown) {
                const advancedValidation = this.validateAdvancedRestrictions(card, zoneName, playerId, gameEnv);
                if (!advancedValidation.isValid) {
                    return advancedValidation;
                }
            }

            // 3. Phase Validation
            const phaseValidation = this.validatePhaseRestrictions(card, zoneName, isFaceDown, gameEnv);
            if (!phaseValidation.isValid) {
                return phaseValidation;
            }

            // 4. Card Type Validation
            const typeValidation = this.validateCardTypeRestrictions(card, zoneName, playerId, gameEnv);
            if (!typeValidation.isValid) {
                return typeValidation;
            }

            // 5. Execute Placement
            const executionResult = this.executeCardPlacement(action, card, zoneName, playerId, isFaceDown, gameEnv);
            if (!executionResult.isValid) {
                return executionResult;
            }

            // 6. Process Immediate Effects (only for face-up cards)
            if (!isFaceDown) {
                this.processImmediateEffects(card, zoneName, playerId);
            }

            return { isValid: true };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during card placement';
            console.error('🚨 CardActionHandler error:', errorMessage);
            this.addErrorEvent({ 
                type: 'CARD_PLACEMENT_ERROR', 
                playerId, 
                error: errorMessage 
            });
            return { isValid: false, error: errorMessage };
        }
    }

    /**
     * Layer 1: Basic placement validation
     */
    private validateBasicPlacement(action: CardPlacementAction, playerId: string, gameEnv: any): ValidationResult {
        // Check field index bounds
        if (action.field_idx < 0 || action.field_idx >= 5) {
            return { 
                isValid: false, 
                error: 'INVALID_FIELD_INDEX',
                details: `Field index ${action.field_idx} out of bounds (0-4)` 
            };
        }

        // Check card index bounds
        const playerHand = this.getPlayerHand(playerId);
        if (action.card_idx < 0 || action.card_idx >= playerHand.length) {
            return { 
                isValid: false, 
                error: 'INVALID_CARD_INDEX',
                details: `Card index ${action.card_idx} out of bounds (0-${playerHand.length - 1})` 
            };
        }

        // Check card exists
        const card = playerHand[action.card_idx];
        if (!card) {
            return { 
                isValid: false, 
                error: 'CARD_NOT_FOUND',
                details: `No card found at index ${action.card_idx}` 
            };
        }

        // Check zone occupancy
        const zoneName = ZoneMapping.getZoneFromIndex(action.field_idx) as ZoneName;
        const zone = gameEnv.zones[playerId][zoneName];
        if (zone && zone.length > 0) {
            return { 
                isValid: false, 
                error: 'ZONE_OCCUPIED',
                details: `Zone ${zoneName} already occupied` 
            };
        }

        return { isValid: true };
    }

    /**
     * Layer 2: Advanced restrictions validation (leader effects, field effects)
     */
    private validateAdvancedRestrictions(card: any, zoneName: ZoneName, playerId: string, gameEnv: any): ValidationResult {
        // Check leader zone compatibility
        const leaderCompatibilityResult = this.validateLeaderZoneCompatibility(card, zoneName, playerId, gameEnv);
        if (!leaderCompatibilityResult.isValid) {
            return leaderCompatibilityResult;
        }

        // Check field effect restrictions
        const fieldEffectResult = this.validateFieldEffectRestrictions(card, zoneName, playerId, gameEnv);
        if (!fieldEffectResult.isValid) {
            return fieldEffectResult;
        }

        return { isValid: true };
    }

    /**
     * Layer 3: Phase-based restrictions
     */
    private validatePhaseRestrictions(card: any, zoneName: ZoneName, isFaceDown: boolean, gameEnv: any): ValidationResult {
        const currentPhase = gameEnv.phase;

        // SP Phase restrictions
        if (currentPhase === TurnPhase.SP_PHASE) {
            if (zoneName === 'sp' && !isFaceDown) {
                return { 
                    isValid: false, 
                    error: 'SP_PHASE_FACE_DOWN_REQUIRED',
                    details: 'Cards must be played face-down in SP zone during SP_PHASE' 
                };
            }
        }

        // Main Phase restrictions
        if (currentPhase === TurnPhase.MAIN_PHASE) {
            if (zoneName === 'sp') {
                return { 
                    isValid: false, 
                    error: 'SP_ZONE_WRONG_PHASE',
                    details: 'SP cards can only be played during SP_PHASE' 
                };
            }
        }

        return { isValid: true };
    }

    /**
     * Layer 4: Card type specific validation
     */
    private validateCardTypeRestrictions(card: any, zoneName: ZoneName, playerId: string, gameEnv: any): ValidationResult {
        const cardType = card.cardType;

        // Character card restrictions
        if (cardType === 'character') {
            if (!ZoneMapping.isCharacterZone(zoneName)) {
                return { 
                    isValid: false, 
                    error: 'CHARACTER_ZONE_MISMATCH',
                    details: `Character cards can only be placed in character zones (top, left, right)` 
                };
            }
        }

        // Help card restrictions
        if (cardType === 'help') {
            if (zoneName !== 'help') {
                return { 
                    isValid: false, 
                    error: 'HELP_ZONE_MISMATCH',
                    details: `Help cards can only be placed in help zone` 
                };
            }
        }

        // SP card restrictions
        if (cardType === 'sp') {
            if (zoneName !== 'sp') {
                return { 
                    isValid: false, 
                    error: 'SP_ZONE_MISMATCH',
                    details: `SP cards can only be placed in SP zone` 
                };
            }
        }

        return { isValid: true };
    }

    /**
     * Leader zone compatibility validation
     */
    private validateLeaderZoneCompatibility(card: any, zoneName: ZoneName, playerId: string, gameEnv: any): ValidationResult {
        // Only applies to character zones
        if (!ZoneMapping.isCharacterZone(zoneName)) {
            return { isValid: true };
        }

        // Get current leader
        const leaderZone = gameEnv.zones[playerId].leader;
        if (!leaderZone || leaderZone.length === 0) {
            return { isValid: true }; // No leader restrictions
        }

        const leader = leaderZone[0];
        const leaderData = leader.cardData || leader;

        // Check zone compatibility
        const allowedTypes = leaderData.zoneCompatibility?.[zoneName];
        if (!allowedTypes || allowedTypes === 'ALL') {
            return { isValid: true };
        }

        // Check if card's gameType is allowed
        const cardGameType = card.gameType;
        if (!allowedTypes.includes(cardGameType)) {
            return { 
                isValid: false, 
                error: 'LEADER_ZONE_RESTRICTION',
                details: `Leader ${leaderData.name} does not allow ${cardGameType} cards in ${zoneName} zone` 
            };
        }

        return { isValid: true };
    }

    /**
     * Field effect restrictions validation
     */
    private validateFieldEffectRestrictions(card: any, zoneName: ZoneName, playerId: string, gameEnv: any): ValidationResult {
        const fieldEffects = gameEnv.players?.[playerId]?.fieldEffects;
        if (!fieldEffects) {
            return { isValid: true };
        }

        // Check zone restrictions
        const zoneRestrictions = fieldEffects.zoneRestrictions?.[zoneName.toUpperCase()];
        if (zoneRestrictions && Array.isArray(zoneRestrictions)) {
            const cardGameType = card.gameType;
            if (!zoneRestrictions.includes(cardGameType)) {
                return { 
                    isValid: false, 
                    error: 'FIELD_EFFECT_RESTRICTION',
                    details: `Field effects prevent placing ${cardGameType} cards in ${zoneName} zone` 
                };
            }
        }

        // Check disabled cards
        const disabledCards = fieldEffects.disabledCards || [];
        if (disabledCards.includes(card.id)) {
            return { 
                isValid: false, 
                error: 'CARD_DISABLED',
                details: `Card ${card.name} is disabled by field effects` 
            };
        }

        return { isValid: true };
    }

    /**
     * Execute the card placement
     */
    private executeCardPlacement(
        action: CardPlacementAction, 
        card: any, 
        zoneName: ZoneName, 
        playerId: string, 
        isFaceDown: boolean, 
        gameEnv: any
    ): ValidationResult {
        try {
            // Create card instance for placement
            const cardInstance = {
                cardUid: `${card.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                cardId: card.id,
                cardData: card,
                isFaceDown,
                placedAt: Date.now(),
                placedBy: playerId
            };

            // Place card in zone
            if (!gameEnv.zones[playerId][zoneName]) {
                gameEnv.zones[playerId][zoneName] = [];
            }
            gameEnv.zones[playerId][zoneName].push(cardInstance);

            // Remove card from hand
            const playerHand = this.getPlayerHand(playerId);
            playerHand.splice(action.card_idx, 1);
            this.setPlayerHand(playerId, playerHand);

            // Generate placement event
            this.addGameEvent(gameEnv, 'CARD_PLAYED', {
                playerId,
                card: {
                    cardId: card.id,
                    name: card.name,
                    power: card.power
                },
                zone: zoneName,
                isFaceDown
            });

            // Generate zone filled event
            this.addGameEvent(gameEnv, 'ZONE_FILLED', {
                playerId,
                zone: zoneName
            });

            return { isValid: true };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during placement execution';
            return { 
                isValid: false, 
                error: 'PLACEMENT_EXECUTION_ERROR',
                details: errorMessage 
            };
        }
    }

    /**
     * Process immediate effects for face-up cards
     */
    private processImmediateEffects(card: any, zoneName: ZoneName, playerId: string): void {
        try {
            if (card.cardType === 'character') {
                this.processCharacterSummonEffects(card, playerId, zoneName);
            } else if (card.cardType === 'help') {
                this.processUtilityCardEffects(card, playerId, zoneName);
            }
        } catch (error) {
            console.error('🚨 Error processing immediate effects:', error);
            this.addErrorEvent({
                type: 'EFFECT_PROCESSING_ERROR',
                playerId,
                cardId: card.id,
                error: error instanceof Error ? error.message : 'Unknown effect processing error'
            });
        }
    }
}

export default CardActionHandler;