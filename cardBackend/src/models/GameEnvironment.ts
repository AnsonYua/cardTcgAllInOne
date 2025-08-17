// src/models/GameEnvironment.ts

/**
 * TypeScript class-based structure for GameEnvironment (gameEnv)
 * Converts the existing JSON-based gameEnv into a proper object-oriented structure
 */

// ============ IMPORTS ============

import { PlayerDeckDataResp } from './PlayerDeckDataResp';
import cardInfoUtilsInstance from '../services/CardInfoUtils';
// ============ CARDINFUTILS SINGLETON ============

/**
 * CardInfoUtils singleton with proper path resolution
 * Handles both compiled (dist/) and source (src/) environments
 */
class CardInfoUtilsSingleton {
    private static instance: any = null;
    
    public static getInstance(): any {
        if (!CardInfoUtilsSingleton.instance) {
            try {
                CardInfoUtilsSingleton.instance = cardInfoUtilsInstance;
            } catch (error) {
                console.error('❌ Failed to load CardInfoUtils:', error);
                CardInfoUtilsSingleton.instance = null;
            }
        }
        return CardInfoUtilsSingleton.instance;
    }
    
    public static reset(): void {
        CardInfoUtilsSingleton.instance = null;
    }
}

// ============ ENUMS ============

export enum GamePhase {
    WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
    BOTH_JOINED = 'BOTH_JOINED',
    READY_PHASE = 'READY_PHASE',
    START_REDRAW = 'START_REDRAW',
    REDRAW_PHASE = 'REDRAW_PHASE',
    DRAW_PHASE = 'DRAW_PHASE',
    MAIN_PHASE = 'MAIN_PHASE',
    SP_PHASE = 'SP_PHASE',
    BATTLE_PHASE = 'BATTLE_PHASE',
    END_PHASE = 'END_PHASE'
}

export enum ZoneType {
    TOP = 'top',
    LEFT = 'left',
    RIGHT = 'right',
    HELP = 'help',
    SP = 'sp',
    LEADER = 'leader'
}

export enum ActionType {
    PLAY_CARD = 'PLAY_CARD',
    PLAY_CARD_BACK = 'PLAY_CARD_BACK',
    PLAY_LEADER = 'PLAY_LEADER',
    APPLY_SET_POWER = 'APPLY_SET_POWER',
    APPLY_EFFECT = 'APPLY_EFFECT'
}

export enum EventType {
    ROOM_CREATED = 'ROOM_CREATED',
    GAME_STARTED = 'GAME_STARTED',
    GAME_CREATED = 'GAME_CREATED',
    INITIAL_HAND_DEALT = 'INITIAL_HAND_DEALT',
    PLAYER_JOINED = 'PLAYER_JOINED',
    PLAYER_READY = 'PLAYER_READY',
    HAND_REDRAWN = 'HAND_REDRAWN',
    CARD_PLAYED = 'CARD_PLAYED',
    CARD_DRAWN = 'CARD_DRAWN',
    ZONE_FILLED = 'ZONE_FILLED',
    PHASE_CHANGE = 'PHASE_CHANGE',
    TURN_SWITCH = 'TURN_SWITCH',
    ERROR_OCCURRED = 'ERROR_OCCURRED',
    BATTLE_CALCULATED = 'BATTLE_CALCULATED',
    BATTLE_RESULT = 'BATTLE_RESULT',
    VICTORY_POINTS_AWARDED = 'VICTORY_POINTS_AWARDED',
    DRAW_PHASE_COMPLETE = 'DRAW_PHASE_COMPLETE',
    GAME_PHASE_START = 'GAME_PHASE_START'
}

// ============ INTERFACES ============

export interface CardMapping {
    [uid: string]: string; // UID to cardId mapping
}

export interface PlayerDeckData {
    currentLeaderIdx: number;
    leader: string[]; // Array of leader UIDs
    hand: string[]; // Array of card UIDs in hand
    mainDeck: string[]; // Array of card UIDs in deck
    leaderMapping: CardMapping;
    cardMapping: CardMapping;
}

// ==============================================================================
// COMPREHENSIVE ZONECARD ARCHITECTURE (January 2025)
// ==============================================================================
// Unified card system supporting all card types with type safety and performance

// Base card data interfaces (matching JSON structure)
export interface BaseCardData {
    id: string;
    name: string;
    cardType: string;
    rarity: string;
    effects: {
        description: string;
        rules: EffectRule[];
        immuneToNeutralization?: boolean;
    };
}

export interface CharacterCardData extends BaseCardData {
    cardType: 'character';
    gameType: string;           // Single classification for zone placement
    power: number;              // Combat strength
    traits: string[];           // Array of traits for effect targeting
}

export interface LeaderCardData extends BaseCardData {
    cardType: 'leader';
    gameType: string;
    initialPoint: number;       // Victory points (not power)
    level: number;              // Priority for SP execution
    zoneCompatibility: {        // Zone restriction rules
        top: string[];
        left: string[];
        right: string[];
    };
}

export interface UtilityCardData extends BaseCardData {
    cardType: 'help' | 'sp';
    // Utilities have no power/points - pure effect-based
}

// Union type for all card data
export type CardData = CharacterCardData | LeaderCardData | UtilityCardData;

// Effect system interfaces (matching JSON structure)
export interface EffectRule {
    id: string;
    type: 'continuous' | 'triggered' | 'restriction';
    trigger: {
        event: string;
        conditions?: any[];
    };
    target: {
        owner: 'self' | 'opponent' | 'both';
        zones: string[];
        filters?: any[];
        requiresSelection?: boolean;
        selectCount?: number;
        targetCount?: number;
    };
    effect: {
        type: string;
        value: any;
        [key: string]: any;
    };
}

// ==============================================================================
// UNIFIED ZONECARD INTERFACES
// ==============================================================================

/**
 * Base ZoneCard interface - unified structure for all cards in zones
 * Provides common properties and methods for zone-based operations
 */
export interface BaseZoneCard {
    // Core identification
    cardUid: string;            // Unique game instance ID (e.g., "c-1_game1_001")
    cardId: string;             // Base card ID (e.g., "c-1")
    
    // Card data (embedded for performance)
    cardData: CardData;         // Complete card data from JSON
    
    // Zone-specific state
    isFaceDown: boolean;        // Face-down status (affects all mechanics)
    placedAt?: number;          // Timestamp when placed
    placedBy?: string;          // Player ID who placed card
}

/**
 * Character Zone Card - for character cards in TOP/LEFT/RIGHT zones
 * Handles power calculation, gameType classification, trait-based effects
 */
export interface CharacterZoneCard extends BaseZoneCard {
    cardData: CharacterCardData;
    currentPower?: number;  // Final power after applying all effects
}

/**
 * Leader Zone Card - for leader cards in LEADER zone
 * Handles zone restrictions, global effects, victory points
 */
export interface LeaderZoneCard extends BaseZoneCard {
    cardData: LeaderCardData;
    isFaceDown: false;          // Leaders are always face-up
}

/**
 * Utility Zone Card - for help/sp cards in HELP/SP zones
 * Handles interactive effects, cross-player targeting, special mechanics
 */
export interface UtilityZoneCard extends BaseZoneCard {
    cardData: UtilityCardData;
}

// ==============================================================================
// ZONE CARD UTILITY FUNCTIONS
// ==============================================================================

/**
 * Factory function to create appropriate ZoneCard implementation
 */
export function createZoneCard(
    cardUid: string,
    cardId: string,
    cardData: CardData,
    isFaceDown: boolean = false,
    placedBy: string = ''
): BaseZoneCard {
    const baseCard: BaseZoneCard = {
        cardUid,
        cardId,
        cardData,
        isFaceDown,
        placedAt: Date.now(),
        placedBy
    };

    switch ((cardData as CardData).cardType) {
        case 'character':
            return {
                ...baseCard,
                cardData: cardData as CharacterCardData
            } as CharacterZoneCard;
            
        case 'leader':
            return {
                ...baseCard,
                cardData: cardData as LeaderCardData,
                isFaceDown: false  // Leaders are always face-up
            } as LeaderZoneCard;
            
        case 'help':
        case 'sp':
            return {
                ...baseCard,
                cardData: cardData as UtilityCardData
            } as UtilityZoneCard;
            
        default:
            throw new Error(`Unknown card type: ${(cardData as CardData).cardType}`);
    }
}

/**
 * Type guard functions for zone card types
 */
export function isCharacterZoneCard(card: BaseZoneCard): card is CharacterZoneCard {
    return card.cardData.cardType === 'character';
}

export function isLeaderZoneCard(card: BaseZoneCard): card is LeaderZoneCard {
    return card.cardData.cardType === 'leader';
}

export function isUtilityZoneCard(card: BaseZoneCard): card is UtilityZoneCard {
    return ['help', 'sp'].includes(card.cardData.cardType);
}

/**
 * Card property accessors that handle face-down mechanics
 */
export class ZoneCardUtils {
    /**
     * Get effective power for a card (0 if face-down)
     */
    static getEffectivePower(card: BaseZoneCard): number {
        if (card.isFaceDown || !isCharacterZoneCard(card)) {
            return 0;
        }
        return card.cardData.power;
    }

    /**
     * Get game type for zone compatibility (empty if face-down)
     */
    static getEffectiveGameType(card: BaseZoneCard): string {
        if (card.isFaceDown) {
            return ''; // Face-down cards bypass all restrictions
        }
        if (isCharacterZoneCard(card) || isLeaderZoneCard(card)) {
            return card.cardData.gameType;
        }
        return '';
    }

    /**
     * Get traits for effect targeting (empty if face-down)
     */
    static getEffectiveTraits(card: BaseZoneCard): string[] {
        if (card.isFaceDown || !isCharacterZoneCard(card)) {
            return [];
        }
        return card.cardData.traits || [];
    }

    /**
     * Check if card can trigger effects (false if face-down)
     */
    static canTriggerEffects(card: BaseZoneCard): boolean {
        return !card.isFaceDown && card.cardData.effects?.rules?.length > 0;
    }

    /**
     * Check if card can contribute to power calculation
     */
    static canContributeToCalculation(card: BaseZoneCard): boolean {
        return !card.isFaceDown;
    }

    /**
     * Get zone compatibility for leader cards
     */
    static getZoneCompatibility(leader: LeaderZoneCard): { [zone: string]: string[] } {
        return leader.cardData.zoneCompatibility;
    }

    /**
     * Check if character can be placed in zone under leader
     */
    static canCharacterBePlacedInZone(
        character: CharacterZoneCard, 
        zone: ZoneType, 
        leader: LeaderZoneCard
    ): boolean {
        // Face-down cards bypass all restrictions
        if (character.isFaceDown) {
            return true;
        }

        const zoneKey = zone.toLowerCase() as keyof typeof leader.cardData.zoneCompatibility;
        const allowedTypes = leader.cardData.zoneCompatibility[zoneKey] || [];
        return allowedTypes.includes(character.cardData.gameType);
    }

    /**
     * Get display name (hidden if face-down)
     */
    static getDisplayName(card: BaseZoneCard): string {
        return card.isFaceDown ? 'Hidden Card' : card.cardData.name;
    }

    /**
     * Get card effects (empty if face-down)
     */
    static getActiveEffects(card: BaseZoneCard): EffectRule[] {
        if (card.isFaceDown) {
            return [];
        }
        return card.cardData.effects?.rules || [];
    }
}

/**
 * Legacy compatibility interfaces (deprecated but supported during transition)
 */
export interface LegacyZoneCard {
    card?: string[];  // Old format: [\"cardUid\"]
}

/**
 * Utility function to convert legacy zone card format to unified format
 */
export async function convertLegacyToUnified(
    legacyCard: LegacyZoneCard,
    cardInfoUtils?: any  // Optional - will use singleton if not provided
): Promise<BaseZoneCard | null> {
    if (!legacyCard.card || legacyCard.card.length === 0) {
        return null;
    }
    
    const cardUid = legacyCard.card[0];
    const cardId = cardUid.split('_')[0];
    
    try {
        // Use provided cardInfoUtils or singleton
        const CardInfoUtils = cardInfoUtils || CardInfoUtilsSingleton.getInstance();
        
        if (!CardInfoUtils) {
            console.warn(`CardInfoUtils not available for legacy conversion: ${cardUid}`);
            return null;
        }
        
        let cardData: CardData;
        
        // Determine card type from ID prefix and look up data
        if (cardId.startsWith('s-')) {
            cardData = await CardInfoUtils.getLeaderCards(cardId);
        } else {
            cardData = await CardInfoUtils.getCardDetails(cardId);
        }
        
        if (!cardData) {
            console.warn(`Could not resolve card data for legacy card: ${cardUid}`);
            return null;
        }
        
        return createZoneCard(cardUid, cardId, cardData, false, '');
        
    } catch (error) {
        console.error(`Error converting legacy card ${cardUid}:`, error);
        return null;
    }
}

// Legacy type aliases for backward compatibility
export type ZoneCard = BaseZoneCard;  // Deprecated: use BaseZoneCard

export interface PlayerZones {
    leader?: LeaderZoneCard[];        // Leaders extend ZoneCard
    top?: CharacterZoneCard[];        // Characters extend ZoneCard
    left?: CharacterZoneCard[];       // Characters extend ZoneCard  
    right?: CharacterZoneCard[];      // Characters extend ZoneCard
    help?: UtilityZoneCard[];         // Utility cards extend ZoneCard
    sp?: UtilityZoneCard[];           // Utility cards extend ZoneCard
}

export interface GameZonesData {
    [playerId: string]: PlayerZones;
}

// Utility types for zone operations
export type ZoneContent = ZoneCard[] | LeaderZoneCard[] | undefined;
export type NonLeaderZoneType = Exclude<ZoneType, ZoneType.LEADER>;

// Type guard functions
export const isLeaderZone = (zone: ZoneType): zone is ZoneType.LEADER => {
    return zone === ZoneType.LEADER;
};

export const isZoneCardArray = (content: ZoneContent): content is ZoneCard[] => {
    return Array.isArray(content) && (content.length === 0 || 'card' in content[0]);
};

export const isLeaderZoneCardArray = (content: ZoneContent): content is LeaderZoneCard[] => {
    return Array.isArray(content) && (content.length === 0 || ('id' in content[0] && !('card' in content[0])));
};

export interface GameEvent {
    id: string;
    type: EventType;
    data: any;
    timestamp: number;
    expiresAt: number;
    frontendProcessed: boolean;
    requireFrontendAcknowledgment: boolean;
}

/**
 * Represents a single play action in the game sequence
 * Tracks card plays with unique instance identifiers for proper effect processing
 */
export interface PlaySequenceAction {
    sequenceId: number;
    playerId: string;
    /** Unique card instance identifier (e.g., "c-43_player1_001") - NOT base card ID */
    cardUid: string;
    action: ActionType;
    zone: ZoneType;
    isFaceDown?: boolean;
    effectData?: any;
}

export interface PlaySequence {
    globalSequence: number;
    plays: PlaySequenceAction[];
}

// Legacy FieldEffect interface - use ActiveEffect instead for new code
export interface FieldEffect {
    effectId: string;
    source: string;
    sourcePlayerId?: string;
    type: string;
    target: {
        scope: 'SELF' | 'OPPONENT' | 'ALL';
        zones?: ZoneType[] | 'ALL';
        gameTypes?: string[];
        traits?: string[];
        playerId?: string;
    };
    value: number | boolean;
    priority?: number;
    unremovable?: boolean;
    isEnabled?: boolean;
    createdAt?: number;
    effectData?: any;
}

// Enhanced FieldEffect using ActiveEffect for type-safe effect processing
export interface EnhancedFieldEffect {
    // Runtime context
    effectId: string;
    sourceCardUid: string;
    sourcePlayerId: string;
    targetPlayerId: string;
    createdAt: number;
    isActive: boolean;
    
    // Direct JSON structure preservation
    rule: EffectRule;
}

export interface PlayerFieldEffects {
    zoneRestrictions: {
        [zone in ZoneType]?: string[] | 'ALL';
    };
    // Legacy format - maintaining compatibility
    activeEffects: FieldEffect[];
    // New enhanced format - preferred for new code
    activeEffectsEnhanced?: EnhancedFieldEffect[];
    specialEffects?: {
        zonePlacementFreedom?: boolean;
        immuneToNeutralization?: boolean;
    };
    disabledCards?: string[];
    victoryPointModifiers?: number;
}

export interface NeutralizationAction {
    timestamp: number;
    playerId: string;
    targetCardId: string;
    neutralizedBy: string;
    reason: string;
}

// ============ OPTIMIZED VALIDATION SYSTEM INTERFACES ============

// REMOVED: ValidationState interface - using fieldEffects as single source of truth

// REMOVED: PlayerRestrictions, AvailableAction, CardValidation interfaces
// These duplicated functionality already provided by PlayerFieldEffects
// Using existing fieldEffects system as single source of truth

// EffectDelta interface deprecated - replaced by ActiveEffect state management
export interface EffectDelta {
    sequenceId: number;
    cardUid: string;
    playerId: string;
    effects: any[]; // Replaced by ActiveEffect instances
    affectedPlayers: string[];
    timestamp: number;
}

// CalculatedEffect interface removed - replaced by ActiveEffect class system
// See ActiveEffect.ts for the new type-safe effect processing

export interface GameResult {
    success: boolean;
    error?: string;
    gameState?: any;
    requiresCardSelection?: boolean;
    selectionData?: any;
    processingTime?: number;
    // REMOVED: validationState - using fieldEffects as single source of truth
}

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    warnings?: string[];
}

// ============ CLASSES ============

export class Player {
    public id: string;
    public name: string;
    public deck: PlayerDeckDataResp;
    public redraw: number;
    public turnAction: any[];
    public playerPoint: number;
    public isReady: boolean;
    public fieldEffects?: PlayerFieldEffects;

    constructor(id: string, name: string = id) {
        this.id = id;
        this.name = name;
        this.redraw = 0;
        this.turnAction = [];
        this.playerPoint = 0;
        this.isReady = false;
        this.deck = new PlayerDeckDataResp();
    }

    // ============ DECK METHODS ============
    // Delegate to PlayerDeckDataResp class methods

    public getCurrentLeader(): string | null {
        return this.deck.getCurrentLeader();
    }

    public getCurrentLeaderCardId(): string | null {
        return this.deck.getCurrentLeaderCardId();
    }
    
    public getCurrentLeaderCardUId(): string | null {
        return this.deck.getCurrentLeaderCardUId();
    }

    public drawCard(): string | null {
        return this.deck.drawCard();
    }

    public playCardFromHand(cardUid: string): boolean {
        return this.deck.playCardFromHand(cardUid);
    }

    public getHandSize(): number {
        return this.deck.getHandSize();
    }

    public getDeckSize(): number {
        return this.deck.getDeckSize();
    }

    public advanceToNextLeader(): boolean {
        return this.deck.advanceToNextLeader();
    }

    public getCardIdFromUid(cardUid: string): string | null {
        return this.deck.getCardIdFromUid(cardUid);
    }


    // ============ PLAYER STATE INITIALIZATION ============

    /**
     * Initialize player game state without resetting field effects
     * Preserves existing fieldEffects while resetting other game state
     * Used in startReady to avoid losing fieldEffects from joinRoom
     */
    public initializeGameStateOnly(): void {
        // Initialize field effects only if they don't exist yet
        if (!this.fieldEffects) {
            this.fieldEffects = {
                zoneRestrictions: {},
                activeEffects: [],
                specialEffects: {},
                disabledCards: [],
                victoryPointModifiers: 0
            };
        }
        // If fieldEffects already exist, preserve them and don't reset
        
        // Initialize player game state
        this.turnAction = [];
        this.playerPoint = 0;
        
        // NOTE: redraw and isReady are handled elsewhere:
        // - redraw is managed by requestRedraw() method and mozGamePlay.js
        // - isReady is managed by GameEnvironment.setPlayerReady() method
    }

    /**
     * Legacy method for backwards compatibility
     * @deprecated Use initializeGameStateOnly() for game start without resetting fieldEffects
     */
    public initializeFieldEffects(): void {
        this.fieldEffects = {
            zoneRestrictions: {},
            activeEffects: [],
            specialEffects: {},
            disabledCards: [],
            victoryPointModifiers: 0
        };
    }

    public addFieldEffect(effect: FieldEffect): void {
        if (!this.fieldEffects) this.initializeFieldEffects();
        this.fieldEffects!.activeEffects.push(effect);
    }


    // ============ SERIALIZATION ============

    public toJSON(): any {
        return {
            id: this.id,
            name: this.name,
            deck: this.deck.toJSON(), // Convert PlayerDeckDataResp to JSON
            redraw: this.redraw,
            turnAction: this.turnAction,
            playerPoint: this.playerPoint,
            isReady: this.isReady,
            ...(this.fieldEffects && { fieldEffects: this.fieldEffects })
        };
    }

    public static fromJSON(data: any): Player {
        const player = new Player(data.id, data.name);
        // Convert deck data to PlayerDeckDataResp class
        if (data.deck) {
            player.deck = PlayerDeckDataResp.fromJSON(data.deck);
        }
        player.redraw = data.redraw || 0;
        player.turnAction = data.turnAction || [];
        player.playerPoint = data.playerPoint || 0;
        player.isReady = data.isReady || false;
        if (data.fieldEffects) {
            player.fieldEffects = data.fieldEffects;
        }
        return player;
    }
}

export class GameZones {
    private zones: GameZonesData = {};

    /**
     * Initialize empty zones for a player
     */
    public initializePlayerZones(playerId: string): void {
        this.zones[playerId] = {
            leader: [],
            top: [],
            left: [],
            right: [],
            help: [],
            sp: []
        };
    }

    /**
     * Get the raw zones data structure
     */
    public getZonesData(): GameZonesData {
        return this.zones;
    }

    /**
     * Set the entire zones data structure (useful for deserialization)
     */
    public setZonesData(zonesData: GameZonesData): void {
        this.zones = zonesData;
    }

    public getPlayerZones(playerId: string): PlayerZones {
        //console.log("debug getPlayerZones", JSON.stringify(this.zones));
        if (!this.zones[playerId]) {
            this.initializePlayerZones(playerId);
        }
        return this.zones[playerId];
    }

    public setCardInZone(playerId: string, zone: ZoneType, cardUid: string, cardData?: CardData, isFaceDown: boolean = false): void {
        console.log(`🔍 setCardInZone ENTRY: playerId=${playerId}, zone=${zone}, cardUid=${cardUid}, isFaceDown=${isFaceDown}`);
        
        // Convert zone to lowercase to match ZoneType enum values
        const normalizedZone = zone.toLowerCase() as ZoneType;
        console.log(`🔍 DEBUG: Normalized zone from "${zone}" to "${normalizedZone}"`);
        
        let playerZones;
        try {
            playerZones = this.getPlayerZones(playerId);
            console.log(`🔍 setCardInZone: playerZones found:`, !!playerZones);
        } catch (error) {
            console.error(`❌ Error in setCardInZone getPlayerZones:`, error);
            return;
        }
        
        // Extract cardId from cardUid (e.g., "c-43_player1_001" → "c-43")
        const cardId = cardUid.split("_")[0];
        
        // If no cardData provided, look up the card details using CardInfoUtils
        let resolvedCardData = cardData;
        if (!resolvedCardData) {
            try {
                const CardInfoUtils = CardInfoUtilsSingleton.getInstance();
                
                if (CardInfoUtils) {
                    if (zone === ZoneType.LEADER) {
                        // Look up leader card data
                        resolvedCardData = CardInfoUtils.getLeaderCards(cardId);
                    } else {
                        // Look up character/utility card data
                        resolvedCardData = CardInfoUtils.getCardDetails(cardId);
                    }
                }
                
                if (!resolvedCardData) {
                    console.warn(`⚠️ Could not resolve card data for cardId ${cardId}, using basic fallback`);
                    resolvedCardData = { 
                        id: cardId, 
                        name: 'Unknown Card',
                        cardType: 'character',
                        gameType: 'unknown',
                        power: 0,
                        traits: [],
                        rarity: 'common',
                        effects: { description: '', rules: [] }
                    } as CharacterCardData;
                }
            } catch (error) {
                console.warn(`⚠️ Error looking up card data for ${cardId}:`, error);
                resolvedCardData = { 
                    id: cardId, 
                    name: 'Unknown Card',
                    cardType: 'character',
                    gameType: 'unknown',
                    power: 0,
                    traits: [],
                    rarity: 'common',
                    effects: { description: '', rules: [] }
                } as CharacterCardData;
            }
        }
        
        // Create unified ZoneCard using factory function
        const zoneCard = createZoneCard(cardUid, cardId, resolvedCardData, isFaceDown, playerId);
        console.log("test222 ", JSON.stringify(zoneCard))
        zoneCard.cardUid = cardUid
        console.log("test333 ", JSON.stringify(zoneCard))
        // Place card in appropriate zone
        console.log(`🔍 DEBUG: About to place card in zone ${normalizedZone}. Zone types: LEADER=${ZoneType.LEADER}, LEFT=${ZoneType.LEFT}`);
        console.log(`🔍 DEBUG: Zone comparison: normalizedZone === ZoneType.LEADER? ${normalizedZone === ZoneType.LEADER}, normalizedZone === ZoneType.LEFT? ${normalizedZone === ZoneType.LEFT}`);
        console.log(`🔍 DEBUG: Zone type check: typeof normalizedZone = ${typeof normalizedZone}, normalizedZone value = "${normalizedZone}"`);
        if (normalizedZone === ZoneType.LEADER) {
            console.log(`🔍 DEBUG: Placing leader card`);
            if (!playerZones.leader) playerZones.leader = [];
            playerZones.leader.push(zoneCard as LeaderZoneCard);
            
        } else if (normalizedZone === ZoneType.TOP || normalizedZone === ZoneType.LEFT || normalizedZone === ZoneType.RIGHT) {
            // Character zones
            console.log(`🔍 DEBUG: Accessing zone ${normalizedZone} in playerZones. Available keys:`, Object.keys(playerZones));
            const targetZone = playerZones[normalizedZone] as CharacterZoneCard[];
            console.log(`🔍 DEBUG: targetZone for ${normalizedZone}:`, targetZone, 'isArray:', Array.isArray(targetZone));
            if (Array.isArray(targetZone)) {
                targetZone.push(zoneCard as CharacterZoneCard);
                console.log(`🔍 DEBUG: After push, ${normalizedZone} zone has ${targetZone.length} cards`);
            } else {
                console.log(`❌ ERROR: targetZone for ${normalizedZone} is not an array! Type:`, typeof targetZone, 'Value:', targetZone);
            }
            
        } else if (normalizedZone === ZoneType.HELP || normalizedZone === ZoneType.SP) {
            // Utility zones (help/sp cards)
            const targetZone = playerZones[normalizedZone] as UtilityZoneCard[];
            if (Array.isArray(targetZone)) {
                targetZone.push(zoneCard as UtilityZoneCard);
            }
        }
        
        // Final verification
        const finalPlayerZones = this.getPlayerZones(playerId);
        const finalZoneContent = finalPlayerZones[normalizedZone];
        console.log(`🔍 FINAL DEBUG: After placement, ${normalizedZone} zone contains:`, finalZoneContent);
        
        console.log(`✅ Set card in zone: ${cardUid} (${cardId}) → ${zone} for player ${playerId}${isFaceDown ? ' (face-down)' : ''} with data: ${resolvedCardData.name || 'Unknown'}`);
    }

    /**
     * Enhanced method that accepts resolved card data for proper object creation
     * This should be used when full card data is available
     */
    public setCardInZoneWithData(playerId: string, zone: ZoneType, cardUid: string, cardData: any, isFaceDown: boolean = false): void {
        this.setCardInZone(playerId, zone, cardUid, cardData, isFaceDown);
    }

    public setLeaderInZone(playerId: string, leaderData: any): void {
        // Convert old-style leaderData to new unified ZoneCard structure
        const cardUid = leaderData.uid
        const cardId = leaderData.id?.split("_")[0] || leaderData.cardId || leaderData.id;
        
        // Ensure leaderData has proper structure for CardData
        const normalizedLeaderData: LeaderCardData = {
            id: cardId,
            name: leaderData.name || 'Unknown Leader',
            cardType: 'leader',
            gameType: leaderData.gameType || 'unknown',
            initialPoint: leaderData.initialPoint || 0,
            level: leaderData.level || 1,
            rarity: leaderData.rarity || 'common',
            zoneCompatibility: leaderData.zoneCompatibility || {
                top: [],
                left: [],
                right: []
            },
            effects: leaderData.effects || { description: '', rules: [] }
        };
        
        // Create unified LeaderZoneCard using factory function
        const leaderCard = createZoneCard(cardUid, cardId, normalizedLeaderData, false, playerId) as LeaderZoneCard;
        
        const playerZones = this.getPlayerZones(playerId);
        if (!playerZones.leader) playerZones.leader = [];
        playerZones.leader.push(leaderCard);
        
        console.log(`✅ Set leader in zone: ${cardUid} (${cardId}) for player ${playerId} - ${normalizedLeaderData.name}`);
    }

    public getLeaderInZone(playerId: string): LeaderZoneCard | null {
        const playerZones = this.getPlayerZones(playerId);
        return playerZones.leader?.[0] || null;
    }

    public getCardInZone(playerId: string, zone: ZoneType): string | null {
        const playerZones = this.getPlayerZones(playerId);
        
        // All zones now use unified ZoneCard structure with cardUid property
        const targetZone = playerZones[zone];
        if (Array.isArray(targetZone) && targetZone.length > 0) {
            const zoneCard = targetZone[0] as BaseZoneCard;
            return zoneCard.cardUid || null;
        }
        
        return null;
    }
    
    /**
     * Get the full card object (with data) from a zone
     */
    public getCardObjectInZone(playerId: string, zone: ZoneType): BaseZoneCard | null {
        const playerZones = this.getPlayerZones(playerId);
        
        const targetZone = playerZones[zone];
        if (Array.isArray(targetZone) && targetZone.length > 0) {
            return targetZone[0] as BaseZoneCard;
        }
        
        return null;
    }

    public isZoneOccupied(playerId: string, zone: ZoneType): boolean {
        return this.getCardInZone(playerId, zone) !== null;
    }

    public clearZone(playerId: string, zone: ZoneType): void {
        const playerZones = this.getPlayerZones(playerId);
        
        if (zone === ZoneType.LEADER) {
            if (playerZones.leader) {
                playerZones.leader.length = 0; // Clear the array
            }
        } else {
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone)) {
                targetZone.length = 0; // Clear the array
            }
        }
    }

    public getAllPlayerIds(): string[] {
        return Object.keys(this.zones);
    }

    // ============ VALIDATION METHODS ============

    public areAllCharacterZonesFilled(playerId: string): boolean {
        return this.isZoneOccupied(playerId, ZoneType.TOP) &&
               this.isZoneOccupied(playerId, ZoneType.LEFT) &&
               this.isZoneOccupied(playerId, ZoneType.RIGHT);
    }

    public isHelpZoneFilled(playerId: string): boolean {
        return this.isZoneOccupied(playerId, ZoneType.HELP);
    }

    public isSpZoneFilled(playerId: string): boolean {
        return this.isZoneOccupied(playerId, ZoneType.SP);
    }

    // ============ SERIALIZATION ============

    public toJSON(): GameZonesData {
        return this.zones;
    }

    public static fromJSON(data: GameZonesData | any): GameZones {
        const gameZones = new GameZones();
        gameZones.setZonesData(data || {});
        return gameZones;
    }
}

export class EventManager {
    private events: GameEvent[] = [];
    private lastEventId: number = 0;

    public addEvent(type: EventType, data: any, requireFrontendAcknowledgment: boolean = false): GameEvent {
        this.lastEventId++;
        const timestamp = Date.now();
        
        const event: GameEvent = {
            id: `event_${timestamp}_${this.lastEventId}`,
            type,
            data,
            timestamp,
            expiresAt: timestamp + 3000, // 3 seconds expiry
            frontendProcessed: false,
            requireFrontendAcknowledgment: requireFrontendAcknowledgment
        };
        
        this.events.push(event);
        this.cleanupExpiredEvents();
        
        return event;
    }

    public getEvents(): GameEvent[] {
        this.cleanupExpiredEvents();
        return [...this.events];
    }

    public getUnprocessedEvents(): GameEvent[] {
        return this.events.filter(event => !event.frontendProcessed);
    }

    public acknowledgeEvents(eventIds: string[]): void {
        this.events.forEach(event => {
            if (eventIds.includes(event.id)) {
                event.frontendProcessed = true;
                event.requireFrontendAcknowledgment = false;
            }
        });
        //this.cleanupExpiredEvents();
    }

    private cleanupExpiredEvents(): void {
        const now = Date.now();
        this.events = this.events.filter(event => 
            event.expiresAt > now || !event.frontendProcessed
        );
    }

    public getLastEventId(): number {
        return this.lastEventId;
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        return {
            gameEvents: this.events,
            lastEventId: this.lastEventId
        };
    }

    public static fromJSON(data: any): EventManager {
        const manager = new EventManager();
        manager.events = data.gameEvents || [];
        manager.lastEventId = data.lastEventId || 0;
        return manager;
    }
}

export class PlaySequenceManager {
    private sequence: PlaySequence;

    constructor() {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
    }

    /**
     * Add a play action to the sequence
     * @param playerId - ID of the player making the play
     * @param cardUid - Unique card instance identifier (e.g., "c-43_player1_001")
     * @param action - Type of action being performed
     * @param zone - Zone where the card is being played
     * @param isFaceDown - Whether card is played face-down (optional)
     * @param effectData - Additional effect data (optional)
     * @returns The created PlaySequenceAction
     */
    public addPlay(playerId: string, cardUid: string, action: ActionType, zone: ZoneType, isFaceDown: boolean = false, effectData?: any): PlaySequenceAction {
        this.sequence.globalSequence++;
        
        const play: PlaySequenceAction = {
            sequenceId: this.sequence.globalSequence,
            playerId,
            cardUid,
            action,
            zone,
            ...(isFaceDown && { isFaceDown }),
            ...(effectData && { effectData })
        };
        
        this.sequence.plays.push(play);
        return play;
    }

    public getPlays(): PlaySequenceAction[] {
        return [...this.sequence.plays];
    }

    public getGlobalSequence(): number {
        return this.sequence.globalSequence;
    }
    public getNextSequenceId(): number {
        return this.sequence.globalSequence + 1;
    }
    public recordAction(action: PlaySequenceAction): void {
        this.sequence.globalSequence = action.sequenceId;
        this.sequence.plays.push(action);
    }

    public clearSequence(): void {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        return this.sequence;
    }

    public static fromJSON(data: any): PlaySequenceManager {
        const manager = new PlaySequenceManager();
        manager.sequence = data || { globalSequence: 0, plays: [] };
        return manager;
    }
}

// ============ MAIN GAME ENVIRONMENT CLASS ============

export class GameEnvironment {
    // Core game state
    public phase: GamePhase;
    public playerId_1: string | null;
    public playerId_2: string | null;
    public gameStarted: boolean;
    public firstPlayer: number;
    public currentPlayer: string | null;
    public currentTurn: number;
    public playersReady: { [playerId: string]: boolean };
    
    // Object-oriented components
    public players: { [playerId: string]: Player };
    public zones: GameZones;
    public eventManager: EventManager;
    public playSequenceManager: PlaySequenceManager;
    
    // REMOVED: validationState - using existing fieldEffects as single source of truth
    
    // Legacy compatibility
    public fieldEffects: { [playerId: string]: PlayerFieldEffects };
    public neutralizationHistory: NeutralizationAction[];
    
    // Event system
    public gameEvents?: any[];
    public lastEventId?: number;
    
    // Card selection system
    public pendingPlayerAction?: any;
    public pendingCardSelections?: { [selectionId: string]: any };
    
    // Incremental effect processing
    public lastProcessedSequence: number;

    constructor() {
        this.phase = GamePhase.WAITING_FOR_PLAYERS;
        this.playerId_1 = null;
        this.playerId_2 = null;
        this.gameStarted = false;
        this.firstPlayer = 0;
        this.currentPlayer = null;
        this.currentTurn = 0;
        this.playersReady = {};
        
        this.players = {};
        this.zones = new GameZones();
        this.eventManager = new EventManager();
        this.playSequenceManager = new PlaySequenceManager();
        
        // REMOVED: validationState initialization - using fieldEffects as single source of truth
        
        this.fieldEffects = {};
        this.neutralizationHistory = [];
        this.lastProcessedSequence = 0;
    }

    // ============ PLAYER MANAGEMENT ============

    public addPlayer(playerId: string, playerName?: string): Player {
        const player = new Player(playerId, playerName || playerId);
        this.players[playerId] = player;
        this.zones.initializePlayerZones(playerId);
        
        // Set player IDs based on order
        if (playerId == "playerId_1") {
            this.playerId_1 = playerId;
        } else if (playerId == "playerId_2") {
            this.playerId_2 = playerId;
        }
        
        return player;
    }

    public getPlayer(playerId: string): Player | null {
        return this.players[playerId] || null;
    }

    public getAllPlayers(): Player[] {
        return Object.values(this.players);
    }

    public getOpponentId(playerId: string): string | null {
        if (playerId === this.playerId_1) return this.playerId_2;
        if (playerId === this.playerId_2) return this.playerId_1;
        return null;
    }

    // ============ GAME STATE METHODS ============

    public updatePhase(newPhase: GamePhase): void {
        const oldPhase = this.phase;
        this.phase = newPhase;
        
        this.eventManager.addEvent(EventType.PHASE_CHANGE, {
            oldPhase,
            newPhase,
            timestamp: Date.now()
        });
    }

    public isGameReady(): boolean {
        return this.playerId_1 !== null && this.playerId_2 !== null;
    }

    public canStartGame(): boolean {
        return this.isGameReady() && this.phase === GamePhase.READY_PHASE;
    }

    // ============ PLAYERS READY MANAGEMENT ============
    //set Ready , then draw card and start the games
    public setPlayerReady(playerId: string, isReady: boolean = true): void {
        this.playersReady[playerId] = isReady;
    }

    public isPlayerReady(playerId: string): boolean {
        return this.playersReady[playerId] || false;
    }

    public areAllPlayersReady(): boolean {
        const playerIds = [this.playerId_1, this.playerId_2].filter(id => id !== null);
        return playerIds.length === 2 && playerIds.every(id => id && this.playersReady[id] === true);
    }

    public getPlayersReadyStatus(): { [playerId: string]: boolean } {
        return { ...this.playersReady };
    }

    // ============ PLAYER REDRAW OPERATIONS ============

    /**
     * Process player redraw request during initial game setup
     * Handles the complete redraw workflow including events and deck reshuffling
     * @param playerId - ID of the player requesting redraw
     * @param isRedraw - Whether the player wants to redraw their hand
     * @returns Promise<void>
     * @throws Error if player not found
     */
    public async processPlayerRedraw(playerId: string, isRedraw: boolean): Promise<void> {
        const player = this.getPlayer(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        
        // Delegate to player deck's requestRedraw method which handles the core logic
        const redrawState = { redraw: player.redraw };
        const reshuffled = await player.deck.requestRedraw(playerId, isRedraw, redrawState);
        // Update player's redraw state after the call
        player.redraw = redrawState.redraw;
        
        // Add PLAYER_READY event through EventManager
        this.eventManager.addEvent(EventType.PLAYER_READY, {
            playerId: playerId,
            redrawRequested: isRedraw
        });
        
        // Add HAND_REDRAWN event if reshuffling occurred
        if (reshuffled) {
            this.eventManager.addEvent(EventType.HAND_REDRAWN, {
                playerId: playerId,
                newHandSize: player.getHandSize()
            });
        }
    }

    // ============ ZONE OPERATIONS ============

    public isZoneOccupied(playerId: string, zone: ZoneType): boolean {
        return this.zones.isZoneOccupied(playerId, zone);
    }

    public placeCardInZone(playerId: string, zone: ZoneType, cardUID: string, isFaceDown: boolean = false): boolean {
        // Debug: Log what we're trying to place
        console.log(`🔍 placeCardInZone called: playerId=${playerId}, zone=${zone}, cardUID=${cardUID}, isFaceDown=${isFaceDown}`);
        
        // Pass cardUID and isFaceDown to setCardInZone
        this.zones.setCardInZone(playerId, zone, cardUID, undefined, isFaceDown);
        
        // Debug: Check if placement succeeded
        const playerZones = this.zones.getPlayerZones(playerId);
        const zoneName = zone.toLowerCase() as keyof typeof playerZones;
        console.log(`🔍 After setCardInZone: ${zone} zone contains:`, playerZones[zoneName]);
        
        return true;
    }

    public playCard(playerId: string, cardUid: string, zone: ZoneType, isFaceDown: boolean = false): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        // Remove card from hand
        if (!player.playCardFromHand(cardUid)) return false;
        
        // Place card in zone
        this.zones.setCardInZone(playerId, zone, cardUid);
        
        // Record in play sequence
        const action = isFaceDown ? ActionType.PLAY_CARD_BACK : ActionType.PLAY_CARD;
        this.playSequenceManager.addPlay(playerId, cardUid, action, zone, isFaceDown);
        
        // Add event
        this.eventManager.addEvent(EventType.CARD_PLAYED, {
            playerId,
            cardUid,
            zone,
            isFaceDown
        });
        
        return true;
    }

    public setLeader(playerId: string, leaderUid: string): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        this.zones.setCardInZone(playerId, ZoneType.LEADER, leaderUid);
        this.playSequenceManager.addPlay(playerId, leaderUid, ActionType.PLAY_LEADER, ZoneType.LEADER);
        
        return true;
    }

    // ============ VALIDATION METHODS ============

    public areAllMainZonesFilled(): boolean {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.every(playerId => 
            this.zones.areAllCharacterZonesFilled(playerId) && 
            this.zones.isHelpZoneFilled(playerId)
        );
    }

    public areAllSpZonesFilled(): boolean {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.every(playerId => this.zones.isSpZoneFilled(playerId));
    }

    // ============ NEUTRALIZATION TRACKING ============

    public addNeutralizationAction(playerId: string, targetCardId: string, neutralizedBy: string, reason: string): void {
        this.neutralizationHistory.push({
            timestamp: Date.now(),
            playerId,
            targetCardId,
            neutralizedBy,
            reason
        });
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        // Convert to legacy format for compatibility
        const legacy = {
            phase: this.phase,
            playerId_1: this.playerId_1,
            playerId_2: this.playerId_2,
            gameStarted: this.gameStarted,
            firstPlayer: this.firstPlayer,
            currentPlayer: this.currentPlayer,
            currentTurn: this.currentTurn,
            playersReady: this.playersReady,
            
            // Convert players to legacy format
            players: {},
            zones: this.zones.toJSON(),
            fieldEffects: this.fieldEffects,
            neutralizationHistory: this.neutralizationHistory,
            
            // REMOVED: validationState serialization - using fieldEffects as single source of truth
            
            // Event system
            ...this.eventManager.toJSON(),
            
            // Play sequence
            playSequence: this.playSequenceManager.toJSON(),
            
            // Incremental effect processing
            lastProcessedSequence: this.lastProcessedSequence
        };
        
        // Convert players
        for (const [playerId, player] of Object.entries(this.players)) {
            legacy.players[playerId] = player.toJSON();
        }
        
        return legacy;
    }

    public static fromJSON(data: any): GameEnvironment {
        const gameEnv = new GameEnvironment();
        
        // Basic properties
        gameEnv.phase = data.phase || GamePhase.WAITING_FOR_PLAYERS;
        gameEnv.playerId_1 = data.playerId_1 || null;
        gameEnv.playerId_2 = data.playerId_2 || null;
        gameEnv.gameStarted = data.gameStarted || false;
        gameEnv.firstPlayer = data.firstPlayer || 0;
        gameEnv.currentPlayer = data.currentPlayer || null;
        gameEnv.currentTurn = data.currentTurn || 0;
        gameEnv.playersReady = data.playersReady || {};
        
        // Players
        if (data.players) {
            for (const [playerId, playerData] of Object.entries(data.players)) {
                gameEnv.players[playerId] = Player.fromJSON(playerData);
            }
        }
        
        // Zones
        gameEnv.zones = GameZones.fromJSON(data.zones);
        
        // Event system
        gameEnv.eventManager = EventManager.fromJSON(data);
        
        // Play sequence
        gameEnv.playSequenceManager = PlaySequenceManager.fromJSON(data.playSequence);
        
        // Legacy compatibility
        gameEnv.fieldEffects = data.fieldEffects || {};
        gameEnv.neutralizationHistory = data.neutralizationHistory || [];
        
        // Incremental effect processing
        gameEnv.lastProcessedSequence = data.lastProcessedSequence || 0;
        
        // REMOVED: validationState deserialization - using fieldEffects as single source of truth
        
        return gameEnv;
    }

    // ============ UTILITY METHODS ============

    public clone(): GameEnvironment {
        return GameEnvironment.fromJSON(this.toJSON());
    }

    public toString(): string {
        return JSON.stringify(this.toJSON(), null, 2);
    }
}

// ============ FACTORY FUNCTIONS ============

export function createGameEnvironment(): GameEnvironment {
    return new GameEnvironment();
}

export function createGameEnvironmentFromJSON(data: any): GameEnvironment {
    return GameEnvironment.fromJSON(data);
}

// Export singleton for external use
export { CardInfoUtilsSingleton };

// ============ EXPORTS ============

export default {
    GameEnvironment,
    Player,
    GameZones,
    EventManager,
    PlaySequenceManager,
    GamePhase,
    ZoneType,
    ActionType,
    EventType,
    createGameEnvironment,
    createGameEnvironmentFromJSON,
    CardInfoUtilsSingleton
};