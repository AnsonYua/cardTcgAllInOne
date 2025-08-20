/**
 * CardSelection.ts - TypeScript interfaces for card selection system
 * 
 * Provides type safety for the dynamic card selection system including
 * integration with EnhancedEffectManager's dynamic selectionType functionality.
 */

import { GameEnvironment } from './GameEnvironment';

/**
 * Core card selection data structure stored in gameEnv.pendingCardSelections
 */
export interface CardSelectionData {
    playerId: string;
    eligibleCards: EligibleCard[];
    selectCount: number;
    effect: SelectionEffect;
    effectType: string;
    selectionType: string; // Dynamic from card JSON data
    sourceCard: string;
    targetPlayerId?: string; // For cross-player effects
}

/**
 * Individual eligible card for selection
 */
export interface EligibleCard {
    cardId: string;
    cardUid?: string;
    zone: string;
    cardData: CardDetails;
}

/**
 * Card details structure
 */
export interface CardDetails {
    id: string;
    name: string;
    cardType: string;
    gameType?: string;
    power?: number;
    traits?: string[];
}

/**
 * Effect data associated with a card selection
 */
export interface SelectionEffect {
    type: string;
    value?: number;
    destination?: string;
    sourceCard: string;
}

/**
 * Selection validation result
 */
export interface SelectionValidation {
    valid: boolean;
    invalidCard?: string;
}

/**
 * Card selection action from frontend
 */
export interface SelectCardAction {
    type: 'SelectCard';
    selectionId: string;
    selectedCardUIds: string[]; // Unified UID-based system
    selectionType?: string; // Optional for backward compatibility
}

/**
 * Result of card selection processing
 */
export interface CardSelectionResult {
    success: boolean;
    error?: string;
    gameEnv?: GameEnvironment;
    requiresCardSelection?: boolean;
    selectionData?: any;
}

/**
 * Selection type enumeration for type safety
 */
export enum SelectionType {
    DECK_SEARCH = 'deckSearch',
    FIELD_TARGET = 'fieldTarget', 
    SINGLE_TARGET = 'SingleTargetSelection',
    TARGET_SELECTION = 'targetSelection',
    SP_SEARCH = 'spSearch',
    HELP_SEARCH = 'helpSearch',
    CHARACTER_SEARCH = 'characterSearch'
}

/**
 * Effect type enumeration
 */
export enum EffectType {
    POWER_BOOST = 'powerBoost',
    POWER_NERF = 'powerNerf',
    SET_POWER = 'setPower',
    SEARCH_CARD = 'searchCard',
    NEUTRALIZE_EFFECT = 'neutralizeEffect',
    DRAW_CARDS = 'drawCards'
}

/**
 * Zone enumeration for type safety
 */
export enum Zone {
    TOP = 'top',
    LEFT = 'left', 
    RIGHT = 'right',
    HELP = 'help',
    SP = 'sp',
    LEADER = 'leader',
    DECK = 'deck',
    HAND = 'hand'
}

/**
 * Destination enumeration for search effects
 */
export enum Destination {
    HAND = 'hand',
    SP_ZONE = 'spZone',
    HELP_ZONE = 'helpZone',
    CONDITIONAL_HELP_ZONE = 'conditionalHelpZone'
}

/**
 * ActiveEffect interface for proper effect storage
 * Integrates with EnhancedEffectManager's ActiveEffect class
 */
export interface ActiveEffectData {
    effectId: string;
    source: string;
    sourcePlayerId: string;
    type: string;
    target: {
        scope: 'SELF' | 'OPPONENT' | 'ALL' | 'SPECIFIC';
        cardIds?: string[];
        zones?: string[];
        gameTypes?: string[];
        traits?: string[];
    };
    value: number;
    isEnabled: boolean;
    createdAt: number;
}

/**
 * Card selection handler configuration
 */
export interface CardSelectionConfig {
    enableTypeInference: boolean;
    validateEligibleCards: boolean;
    autoCompleteFlow: boolean;
}