// src/services/GameValidator.ts
// Centralized validation and error handling for game operations

import { GameEnvironment } from '../models/GameEnvironment';
import { Player } from '../models/Player';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotUtils } from '../utils/SlotUtils';

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    errorCode?: string;
}

export interface PlayerValidationResult extends ValidationResult {
    player?: Player;
}

export interface CardValidationResult extends ValidationResult {
    cardData?: any;
}

export interface SlotValidationResult extends ValidationResult {
    unit?: any;
    slot?: string;
}

/**
 * Centralized validation class for game operations
 * Reduces code duplication and provides consistent error handling
 */
export class GameValidator {
    
    // ============ GAME ENVIRONMENT VALIDATIONS ============
    
    /**
     * Validate basic game environment structure
     */
    static validateGameEnvironment(gameEnv: GameEnvironment): ValidationResult {
        if (!gameEnv) {
            return {
                isValid: false,
                error: "Game environment is null or undefined",
                errorCode: "GAME_ENV_NULL"
            };
        }
        
        if (!gameEnv.players) {
            return {
                isValid: false,
                error: "Game environment has no players object",
                errorCode: "GAME_ENV_NO_PLAYERS"
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate game is ready for operations
     */
    static validateGameReady(gameEnv: GameEnvironment): ValidationResult {
        const envValidation = this.validateGameEnvironment(gameEnv);
        if (!envValidation.isValid) {
            return envValidation;
        }
        
        if (!gameEnv.playersReady) {
            return {
                isValid: false,
                error: "Game is not ready - players not ready",
                errorCode: "GAME_NOT_READY"
            };
        }
        
        return { isValid: true };
    }
    
    // ============ PLAYER VALIDATIONS ============
    
    /**
     * Validate player exists and has required structure
     */
    static validatePlayer(gameEnv: GameEnvironment, playerId: string): PlayerValidationResult {
        const envValidation = this.validateGameEnvironment(gameEnv);
        if (!envValidation.isValid) {
            return envValidation;
        }
        
        if (!playerId) {
            return {
                isValid: false,
                error: "Player ID is null or undefined",
                errorCode: "PLAYER_ID_NULL"
            };
        }
        
        const player = gameEnv.players[playerId];
        if (!player) {
            return {
                isValid: false,
                error: `Player ${playerId} not found`,
                errorCode: "PLAYER_NOT_FOUND"
            };
        }
        
        return {
            isValid: true,
            player
        };
    }
    
    /**
     * Validate player has zones structure
     */
    static validatePlayerZones(gameEnv: GameEnvironment, playerId: string): PlayerValidationResult {
        const playerValidation = this.validatePlayer(gameEnv, playerId);
        if (!playerValidation.isValid) {
            return playerValidation;
        }
        
        const player = playerValidation.player!;
        if (!player.zones) {
            return {
                isValid: false,
                error: `Player ${playerId} has no zones`,
                errorCode: "PLAYER_NO_ZONES",
                player
            };
        }
        
        return {
            isValid: true,
            player
        };
    }
    
    /**
     * Validate player turn
     */
    static validatePlayerTurn(gameEnv: GameEnvironment, playerId: string): ValidationResult {
        const playerValidation = this.validatePlayer(gameEnv, playerId);
        if (!playerValidation.isValid) {
            return playerValidation;
        }
        
        if (gameEnv.currentPlayer !== playerId) {
            return {
                isValid: false,
                error: `Not player ${playerId}'s turn (current: ${gameEnv.currentPlayer})`,
                errorCode: "WRONG_PLAYER_TURN"
            };
        }
        
        return { isValid: true };
    }
    
    // ============ CARD VALIDATIONS ============
    
    /**
     * Validate card data exists
     */
    static validateCardData(cardData: any, cardId: string): CardValidationResult {
        if (!cardData) {
            return {
                isValid: false,
                error: `Card data not found for ${cardId}`,
                errorCode: "CARD_DATA_NOT_FOUND"
            };
        }
        
        return {
            isValid: true,
            cardData
        };
    }
    
    /**
     * Validate card is in player hand
     */
    static validateCardInHand(gameEnv: GameEnvironment, playerId: string, cardUID: string): ValidationResult {
        const playerValidation = this.validatePlayer(gameEnv, playerId);
        if (!playerValidation.isValid) {
            return playerValidation;
        }
        
        const player = playerValidation.player!;
        if (!player.deck?._handUids) {
            return {
                isValid: false,
                error: `Player ${playerId} has no hand`,
                errorCode: "PLAYER_NO_HAND"
            };
        }
        
        if (!player.deck._handUids.includes(cardUID)) {
            return {
                isValid: false,
                error: `Card ${cardUID} not found in player ${playerId} hand`,
                errorCode: "CARD_NOT_IN_HAND"
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate card has effects
     */
    static validateCardEffects(cardData: any, cardId: string): ValidationResult {
        if (!cardData.effects || !cardData.effects.rules || !Array.isArray(cardData.effects.rules)) {
            return {
                isValid: false,
                error: `Card ${cardId} has no valid effects`,
                errorCode: "CARD_NO_EFFECTS"
            };
        }
        
        return { isValid: true };
    }
    
    // ============ SLOT/ZONE VALIDATIONS ============
    
    /**
     * Validate slot contains unit (using SlotUtils for consistency)
     */
    static validateSlotUnit(gameEnv: GameEnvironment, playerId: string, cardUid: string): SlotValidationResult {
        const zonesValidation = this.validatePlayerZones(gameEnv, playerId);
        if (!zonesValidation.isValid) {
            return zonesValidation;
        }
        
        // Use SlotUtils to find the unit
        const slotResult = SlotUtils.findSlotNameByUnitUidForPlayer(gameEnv, playerId, cardUid);
        
        if (slotResult.found) {
            return {
                isValid: true,
                unit: slotResult.unit,
                slot: slotResult.slotName!
            };
        }
        
        return {
            isValid: false,
            error: slotResult.error || `Unit with UID ${cardUid} not found in any slot for player ${playerId}`,
            errorCode: "UNIT_NOT_FOUND_IN_SLOTS"
        };
    }
    
    /**
     * Validate target zone exists and is accessible
     */
    static validateTargetZone(gameEnv: GameEnvironment, playerId: string, zone: string, cardUid: string): ValidationResult {
        const zonesValidation = this.validatePlayerZones(gameEnv, playerId);
        if (!zonesValidation.isValid) {
            return zonesValidation;
        }
        
        const player = zonesValidation.player!;
        
        // Type-safe access to slot zones
        if (SLOT_ZONES.includes(zone as any)) {
            const slotKey = zone as keyof Pick<typeof player.zones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slot = player.zones[slotKey];
            
            if (!slot?.unit || slot.unit.cardUid !== cardUid) {
                return {
                    isValid: false,
                    error: `Target unit ${cardUid} not found in zone ${zone}`,
                    errorCode: "TARGET_UNIT_NOT_FOUND"
                };
            }
        } else {
            return {
                isValid: false,
                error: `Invalid zone: ${zone}`,
                errorCode: "INVALID_ZONE"
            };
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate trash area exists
     */
    static validateTrashArea(gameEnv: GameEnvironment, playerId: string): ValidationResult {
        const zonesValidation = this.validatePlayerZones(gameEnv, playerId);
        if (!zonesValidation.isValid) {
            return zonesValidation;
        }
        
        const player = zonesValidation.player!;
        if (!player.zones.trashArea) {
            return {
                isValid: false,
                error: `Player ${playerId} has no trash area`,
                errorCode: "PLAYER_NO_TRASH_AREA"
            };
        }
        
        return { isValid: true };
    }
    
    // ============ EVENT VALIDATIONS ============
    
    /**
     * Validate event data structure
     */
    static validateEventData(eventData: any, requiredFields: string[]): ValidationResult {
        if (!eventData) {
            return {
                isValid: false,
                error: "Event data is null or undefined",
                errorCode: "EVENT_DATA_NULL"
            };
        }
        
        for (const field of requiredFields) {
            if (eventData[field] === undefined || eventData[field] === null) {
                return {
                    isValid: false,
                    error: `Required field '${field}' is missing from event data`,
                    errorCode: "EVENT_DATA_MISSING_FIELD"
                };
            }
        }
        
        return { isValid: true };
    }
    
    /**
     * Validate target selection data
     */
    static validateTargetSelection(selectedTarget: any): ValidationResult {
        if (!selectedTarget) {
            return {
                isValid: false,
                error: "No target selected",
                errorCode: "NO_TARGET_SELECTED"
            };
        }
        
        const requiredFields = ['cardUid', 'zone', 'playerId'];
        for (const field of requiredFields) {
            if (!selectedTarget[field]) {
                return {
                    isValid: false,
                    error: `Target selection missing required field: ${field}`,
                    errorCode: "TARGET_SELECTION_INCOMPLETE"
                };
            }
        }
        
        return { isValid: true };
    }
    
    // ============ UTILITY METHODS ============
    
    /**
     * Create standardized error result
     */
    static createError(message: string, errorCode: string): ValidationResult {
        return {
            isValid: false,
            error: message,
            errorCode
        };
    }
    
    /**
     * Create standardized success result
     */
    static createSuccess(): ValidationResult {
        return { isValid: true };
    }
    
    /**
     * Log validation error with consistent format
     */
    static logValidationError(context: string, validation: ValidationResult): void {
        if (!validation.isValid) {
            console.error(`❌ Validation Error in ${context}: ${validation.error} (${validation.errorCode})`);
        }
    }
    
    /**
     * Validate and log with consistent error handling
     */
    static validateWithLogging(context: string, validation: ValidationResult): boolean {
        if (!validation.isValid) {
            this.logValidationError(context, validation);
        }
        return validation.isValid;
    }
}