// src/models/GameEnvironment.ts

/**
 * TypeScript class-based structure for GameEnvironment (gameEnv)
 * Converts the existing JSON-based gameEnv into a proper object-oriented structure
 */

// ============ IMPORTS ============

import { PlayerDeckDataResp } from './PlayerDeckDataResp';
import cardInfoUtilsInstance from '../services/CardInfoUtils';
// PLACEHOLDER: Enhanced effect manager - implement effect processing functionality
import { UnifiedEventManager, GameEvent } from '../services/UnifiedEventManager';
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
    RESOURCE_PHASE = 'RESOURCE_PHASE',
    MAIN_PHASE = 'MAIN_PHASE',
    ATTACK_PHASE = 'ATTACK_PHASE',
    BLOCK_PHASE = 'BLOCK_PHASE',
    DAMAGE_PHASE = 'DAMAGE_PHASE',
    END_PHASE = 'END_PHASE'
}

export enum ZoneType {
    SLOT1 = 'slot1',
    SLOT2 = 'slot2',
    SLOT3 = 'slot3',
    SLOT4 = 'slot4',
    SLOT5 = 'slot5',
    SLOT6 = 'slot6',
    BASE = 'base'
}

export enum ActionType {
    PLAY_UNIT = 'PLAY_UNIT',
    PLAY_PILOT = 'PLAY_PILOT', 
    PLAY_COMMAND = 'PLAY_COMMAND',
    PLAY_BASE = 'PLAY_BASE',
    PAIR_PILOT = 'PAIR_PILOT',
    ACTIVATE_ABILITY = 'ACTIVATE_ABILITY',
    ATTACK = 'ATTACK',
    BLOCK = 'BLOCK',
    REST_CARD = 'REST_CARD',
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
    UNITS_DEPLOYED = 'UNITS_DEPLOYED',
    PILOT_PAIRED = 'PILOT_PAIRED',
    ATTACK_DECLARED = 'ATTACK_DECLARED',
    BLOCK_DECLARED = 'BLOCK_DECLARED',
    DAMAGE_DEALT = 'DAMAGE_DEALT',
    UNIT_DESTROYED = 'UNIT_DESTROYED',
    ABILITY_ACTIVATED = 'ABILITY_ACTIVATED',
    DRAW_PHASE_COMPLETE = 'DRAW_PHASE_COMPLETE',
    GAME_PHASE_START = 'GAME_PHASE_START',
    CARD_SELECTION_REQUIRED = 'CARD_SELECTION_REQUIRED',
    CARD_MOVED_TO_HAND = 'CARD_MOVED_TO_HAND'
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

// Base card data interfaces (matching st01Card.json structure)
export interface BaseCardData {
    id: string;
    name: string;
    cardType: string;
    color: string;
    level: number;
    cost: number;
    zone: string[];             // Array of zone types this card can be played in
    traits: string[];           // Array of traits for effect targeting
    link: string[];             // Array of linked pilots/units
    ap: number;                 // Attack Power
    hp: number;                 // Health Points
    effects: {
        description: string[];
        rules: EffectRule[];
    };
}

export interface UnitCardData extends BaseCardData {
    cardType: 'unit';
    // Units are the primary combat cards with AP/HP
}

export interface PilotCardData extends BaseCardData {
    cardType: 'pilot';
    // Pilots can be paired with units for enhanced effects
}

export interface CommandCardData extends BaseCardData {
    cardType: 'command';
    // Command cards provide temporary effects and abilities
}

export interface BaseStructureData extends BaseCardData {
    cardType: 'base';
    // Base cards provide ongoing effects and board presence
}

// Union type for all card data
export type CardData = UnitCardData | PilotCardData | CommandCardData | BaseStructureData;

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
    
    placedAt?: number;          // Timestamp when placed
    placedBy?: string;          // Player ID who placed card
}

/**
 * Unit Zone Card - for unit cards in slot zones
 * Handles AP/HP calculation, zone compatibility, combat mechanics
 */
export interface UnitZoneCard extends BaseZoneCard {
    cardData: UnitCardData;
    currentAP?: number;     // Current Attack Power after modifiers
    currentHP?: number;     // Current Health Points after damage
    isRested?: boolean;     // Whether the unit is rested (tapped)
    pairedPilot?: string;   // UID of paired pilot if any
}

/**
 * Pilot Zone Card - for pilot cards (can be paired with units)
 * Handles pilot-unit pairing and enhancement effects
 */
export interface PilotZoneCard extends BaseZoneCard {
    cardData: PilotCardData;
    pairedUnit?: string;    // UID of paired unit if any
}

/**
 * Command Zone Card - for command cards
 * Handles one-time and ongoing command effects
 */
export interface CommandZoneCard extends BaseZoneCard {
    cardData: CommandCardData;
    isActivated?: boolean;  // Whether the command has been activated
}

/**
 * Base Structure Zone Card - for base cards
 * Handles base effects and board control
 */
export interface BaseStructureZoneCard extends BaseZoneCard {
    cardData: BaseStructureData;
    isRested?: boolean;     // Whether the base is rested (tapped)
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
    placedBy: string = ''
): BaseZoneCard {
    const baseCard: BaseZoneCard = {
        cardUid,
        cardId,
        cardData,
        placedAt: Date.now(),
        placedBy
    };

    switch ((cardData as CardData).cardType) {
        case 'unit':
            return {
                ...baseCard,
                cardData: cardData as UnitCardData,
                currentAP: cardData.ap,
                currentHP: cardData.hp,
                isRested: false,
                pairedPilot: undefined
            } as UnitZoneCard;
            
        case 'pilot':
            return {
                ...baseCard,
                cardData: cardData as PilotCardData,
                pairedUnit: undefined
            } as PilotZoneCard;
            
        case 'command':
            return {
                ...baseCard,
                cardData: cardData as CommandCardData,
                isActivated: false
            } as CommandZoneCard;
            
        case 'base':
            return {
                ...baseCard,
                cardData: cardData as BaseStructureData,
                isRested: false
            } as BaseStructureZoneCard;
            
        default:
            throw new Error(`Unknown card type: ${(cardData as CardData).cardType}`);
    }
}

/**
 * Type guard functions for zone card types
 */
export function isUnitZoneCard(card: BaseZoneCard): card is UnitZoneCard {
    return card.cardData.cardType === 'unit';
}

export function isPilotZoneCard(card: BaseZoneCard): card is PilotZoneCard {
    return card.cardData.cardType === 'pilot';
}

export function isCommandZoneCard(card: BaseZoneCard): card is CommandZoneCard {
    return card.cardData.cardType === 'command';
}

export function isBaseStructureZoneCard(card: BaseZoneCard): card is BaseStructureZoneCard {
    return card.cardData.cardType === 'base';
}

/**
 * Card property accessors and utilities for new card system
 */
export class ZoneCardUtils {
   
    /**
     * Get card color for gameplay mechanics
     */
    static getCardColor(card: BaseZoneCard): string {
        return card.cardData.color;
    }

    /**
     * Get traits for effect targeting
     */
    static getEffectiveTraits(card: BaseZoneCard): string[] {
        return card.cardData.traits || [];
    }

    /**
     * Get linked pilots/units
     */
    static getLinkedCards(card: BaseZoneCard): string[] {
        return card.cardData.link || [];
    }

    /**
     * Get valid zones for card placement
     */
    static getValidZones(card: BaseZoneCard): string[] {
        return card.cardData.zone || [];
    }

    /**
     * Check if card can be placed in specific zone
     */
    static canBePlacedInZone(card: BaseZoneCard, targetZone: string): boolean {
        const validZones = card.cardData.zone || [];
        return validZones.includes(targetZone) || validZones.includes('Any');
    }

    /**
     * Check if card can trigger effects
     */
    static canTriggerEffects(card: BaseZoneCard): boolean {
        return card.cardData.effects?.rules?.length > 0;
    }

    /**
     * Get current AP for unit cards
     */
    static getCurrentAP(card: BaseZoneCard): number {
        if (isUnitZoneCard(card)) {
            return card.currentAP || card.cardData.ap;
        }
        return card.cardData.ap;
    }

    /**
     * Get current HP for unit cards
     */
    static getCurrentHP(card: BaseZoneCard): number {
        if (isUnitZoneCard(card)) {
            return card.currentHP || card.cardData.hp;
        }
        return card.cardData.hp;
    }

    /**
     * Check if unit is paired with pilot
     */
    static isPaired(card: BaseZoneCard): boolean {
        if (isUnitZoneCard(card)) {
            return !!card.pairedPilot;
        }
        if (isPilotZoneCard(card)) {
            return !!card.pairedUnit;
        }
        return false;
    }

    /**
     * Check if card is rested (tapped)
     */
    static isRested(card: BaseZoneCard): boolean {
        if (isUnitZoneCard(card) || isBaseStructureZoneCard(card)) {
            return card.isRested || false;
        }
        return false;
    }

    /**
     * Get display name
     */
    static getDisplayName(card: BaseZoneCard): string {
        return card.cardData.name;
    }

    /**
     * Get card effects
     */
    static getActiveEffects(card: BaseZoneCard): EffectRule[] {
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
        
        return createZoneCard(cardUid, cardId, cardData, '');
        
    } catch (error) {
        console.error(`Error converting legacy card ${cardUid}:`, error);
        return null;
    }
}

// Legacy type aliases for backward compatibility
export type ZoneCard = BaseZoneCard;  // Deprecated: use BaseZoneCard
// Type aliases for new card system
export type CharacterZoneCard = UnitZoneCard;        // Backward compatibility
export type LeaderZoneCard = BaseStructureZoneCard;  // Backward compatibility
export type UtilityZoneCard = CommandZoneCard;       // Backward compatibility

export interface PlayerZones {
    slot1?: UnitZoneCard[];           // Unit cards in slot 1
    slot2?: UnitZoneCard[];           // Unit cards in slot 2
    slot3?: UnitZoneCard[];           // Unit cards in slot 3
    slot4?: UnitZoneCard[];           // Unit cards in slot 4
    slot5?: UnitZoneCard[];           // Unit cards in slot 5
    slot6?: UnitZoneCard[];           // Unit cards in slot 6
    base?: BaseStructureZoneCard[];   // Base cards
    // Pilots and commands may be stored separately or in special zones
    pilots?: PilotZoneCard[];         // Pilot cards (for pairing)
    commands?: CommandZoneCard[];     // Active command cards
}

export interface GameZonesData {
    [playerId: string]: PlayerZones;
}

// Utility types for zone operations
export type ZoneContent = ZoneCard[] | BaseZoneCard[] | undefined;
export type NonBaseZoneType = Exclude<ZoneType, ZoneType.BASE>;

// Type guard functions for zones
export const isBaseZone = (zone: ZoneType): zone is ZoneType.BASE => {
    return zone === ZoneType.BASE;
};

export const isSlotZone = (zone: ZoneType): boolean => {
    return [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6].includes(zone);
};

export const isZoneCardArray = (content: ZoneContent): content is ZoneCard[] => {
    return Array.isArray(content) && (content.length === 0 || 'cardUid' in content[0]);
};

export const isBaseZoneCardArray = (content: ZoneContent): content is BaseZoneCard[] => {
    return Array.isArray(content) && (content.length === 0 || ('cardUid' in content[0] && content[0].cardData?.cardType === 'base'));
};

// GameEvent interface now imported from UnifiedEventManager

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
    effectData?: any;
    /** Turn number when this action was performed - for turn completion tracking */
    turnNumber?: number;
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
        scope: 'SELF' | 'OPPONENT' | 'ALL' | 'SPECIFIC';
        zones?: ZoneType[] | 'ALL';
        colors?: string[];        // Color-based targeting (Blue, White, etc.)
        traits?: string[];        // Trait-based targeting
        nameContains?: string[];  // Name-based targeting
        playerId?: string;
        cardIds?: string[];       // Specific card targeting
        level?: string;           // Level-based targeting (<=2, >=3, etc.)
        cost?: string;            // Cost-based targeting
    };
    value: number | boolean;
    priority?: number;
    unremovable?: boolean;
    isEnabled?: boolean;
    createdAt?: number;
    effectData?: any;
}


export interface PlayerFieldEffects {
    zoneRestrictions: {
        [zone in ZoneType]?: string[] | 'ALL';
    };
    // Active effects for all field effect processing
    activeEffects: FieldEffect[];
    specialEffects?: {
        zonePlacementFreedom?: boolean;
        immuneToNeutralization?: boolean;
        untargetable?: boolean;           // Cannot be targeted by opponent effects
        canPlayFromResource?: boolean;    // Can play cards from resource zone
    };
    disabledCards?: string[];             // Cards that cannot activate/attack
    restedCards?: string[];               // Cards that are rested (tapped)
    victoryPointModifiers?: number;
    resourceModifiers?: {
        bonusResources?: number;          // Extra resources per turn
        resourceCostReduction?: number;   // Reduce costs by this amount
    };
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
    // REMOVED: turnAction - replaced by gameEnv.playSequence.plays for cleaner architecture
    public playerPoint: number;
    public isReady: boolean;
    public fieldEffects?: PlayerFieldEffects;

    constructor(id: string, name: string = id) {
        this.id = id;
        this.name = name;
        this.redraw = 0;
        // REMOVED: turnAction initialization - using playSequence.plays instead
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
        // REMOVED: turnAction initialization - using playSequence.plays instead
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

    /**
     * Get active zone restrictions computed on-demand by combining base zoneRestrictions with preventSummon effects
     */
    public get activeZoneRestrictions(): { [zone in ZoneType]?: string[] | 'ALL' } {
        if (!this.fieldEffects) return {};

        // All possible traits/colors in the new system
        const ALL_TRAITS = ['Earth Federation', 'White Base Team', 'Academy', 'Newtype', 'Warship'];
        const ALL_COLORS = ['Blue', 'White', 'Red', 'Green', 'Yellow'];

        // Start with base zone restrictions
        const activeRestrictions: { [zone in ZoneType]?: string[] | 'ALL' } = {};
        
        // Copy base zone restrictions
        Object.keys(this.fieldEffects.zoneRestrictions).forEach((zone: string) => {
            const zoneType = zone as ZoneType;
            activeRestrictions[zoneType] = this.fieldEffects!.zoneRestrictions[zoneType];
        });

        // Apply preventSummon effects from activeEffects
        this.fieldEffects.activeEffects.forEach(effect => {
            if (effect.type === 'preventSummon' && effect.isEnabled) {
                // Apply preventSummon restrictions to specified zones
                const targetZones = effect.target.zones || [];
                
                // Handle both array and 'ALL' cases
                const zonesToProcess = targetZones === 'ALL' 
                    ? [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6, ZoneType.BASE]
                    : targetZones as ZoneType[];
                
                zonesToProcess.forEach((zone: ZoneType) => {
                    const zoneType = zone as ZoneType;
                    
                    // If zone had restrictions, modify them
                    if (activeRestrictions[zoneType]) {
                        if (activeRestrictions[zoneType] === 'ALL') {
                            // If it was 'ALL', create list excluding prevented traits/colors
                            if (effect.target.traits?.length || effect.target.colors?.length) {
                                // Start with ALL traits, remove the prevented ones
                                const preventedTraits = effect.target.traits || [];
                                const preventedColors = effect.target.colors || [];
                                activeRestrictions[zoneType] = [...ALL_TRAITS, ...ALL_COLORS].filter(
                                    item => !preventedTraits.includes(item) && !preventedColors.includes(item)
                                );
                            } else {
                                // If no specific traits/colors specified, prevent all
                                activeRestrictions[zoneType] = [];
                            }
                        } else {
                            // If it was an array, apply additional restrictions
                            const currentRestrictions = activeRestrictions[zoneType] as string[];
                            
                            // Filter based on preventSummon target filters
                            if (effect.target.traits?.length || effect.target.colors?.length) {
                                const preventedTraits = effect.target.traits || [];
                                const preventedColors = effect.target.colors || [];
                                activeRestrictions[zoneType] = currentRestrictions.filter(
                                    item => !preventedTraits.includes(item) && !preventedColors.includes(item)
                                );
                            } else {
                                // If no specific traits/colors, prevent all
                                activeRestrictions[zoneType] = [];
                            }
                        }
                    } else {
                        // Zone had no restrictions initially, now prevent based on effect
                        if (effect.target.traits?.length || effect.target.colors?.length) {
                            const preventedTraits = effect.target.traits || [];
                            const preventedColors = effect.target.colors || [];
                            activeRestrictions[zoneType] = [...ALL_TRAITS, ...ALL_COLORS].filter(
                                item => !preventedTraits.includes(item) && !preventedColors.includes(item)
                            );
                        } else {
                            // Prevent all
                            activeRestrictions[zoneType] = [];
                        }
                    }
                });
            }
        });

        return activeRestrictions;
    }


    // ============ SERIALIZATION ============

    public toJSON(): any {
        return {
            id: this.id,
            name: this.name,
            deck: this.deck.toJSON(), // Convert PlayerDeckDataResp to JSON
            redraw: this.redraw,
            // REMOVED: turnAction - using playSequence.plays instead
            playerPoint: this.playerPoint,
            isReady: this.isReady,
            ...(this.fieldEffects && { 
                fieldEffects: {
                    ...this.fieldEffects,
                    activeZoneRestrictions: this.activeZoneRestrictions // Include computed getter
                }
            })
        };
    }

    public static fromJSON(data: any): Player {
        const player = new Player(data.id, data.name);
        // Convert deck data to PlayerDeckDataResp class
        if (data.deck) {
            player.deck = PlayerDeckDataResp.fromJSON(data.deck);
        }
        player.redraw = data.redraw || 0;
        // REMOVED: turnAction assignment - using playSequence.plays instead
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
            slot1: [],
            slot2: [],
            slot3: [],
            slot4: [],
            slot5: [],
            slot6: [],
            base: [],
            pilots: [],
            commands: []
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

    public setCardInZone(playerId: string, zone: ZoneType, cardUid: string, cardData?: CardData): void {
        console.log(`🔍 setCardInZone ENTRY: playerId=${playerId}, zone=${zone}, cardUid=${cardUid}`);
        
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
        
        // Extract cardId from cardUid (e.g., "ST01-001_player1_001" → "ST01-001")
        const cardId = cardUid.split("_")[0];
        
        // If no cardData provided, look up the card details using CardInfoUtils
        let resolvedCardData = cardData;
        if (!resolvedCardData) {
            try {
                const CardInfoUtils = CardInfoUtilsSingleton.getInstance();
                
                if (CardInfoUtils) {
                    // Look up card data from st01Card.json structure
                    resolvedCardData = CardInfoUtils.getCardDetails(cardId);
                }
                
                if (!resolvedCardData) {
                    console.warn(`⚠️ Could not resolve card data for cardId ${cardId}, using basic fallback`);
                    resolvedCardData = { 
                        id: cardId, 
                        name: 'Unknown Card',
                        cardType: 'unit',
                        color: 'Blue',
                        level: 1,
                        cost: 1,
                        zone: ['Space', 'Earth'],
                        traits: [],
                        link: [],
                        ap: 1,
                        hp: 1,
                        effects: { description: [], rules: [] }
                    } as UnitCardData;
                }
            } catch (error) {
                console.warn(`⚠️ Error looking up card data for ${cardId}:`, error);
                resolvedCardData = { 
                    id: cardId, 
                    name: 'Unknown Card',
                    cardType: 'unit',
                    color: 'Blue',
                    level: 1,
                    cost: 1,
                    zone: ['Space', 'Earth'],
                    traits: [],
                    link: [],
                    ap: 1,
                    hp: 1,
                    effects: { description: [], rules: [] }
                } as UnitCardData;
            }
        }
        
        // Create unified ZoneCard using factory function
        const zoneCard = createZoneCard(cardUid, cardId, resolvedCardData, playerId);
        console.log("test222 ", JSON.stringify(zoneCard))
        zoneCard.cardUid = cardUid
        console.log("test333 ", JSON.stringify(zoneCard))
        // Place card in appropriate zone
        console.log(`🔍 DEBUG: About to place card in zone ${normalizedZone}`);
        
        if (isSlotZone(normalizedZone)) {
            // Slot zones (slot1-slot6) - primarily for units
            console.log(`🔍 DEBUG: Placing in slot zone ${normalizedZone}`);
            const targetZone = playerZones[normalizedZone] as UnitZoneCard[];
            if (Array.isArray(targetZone)) {
                targetZone.push(zoneCard as UnitZoneCard);
                console.log(`🔍 DEBUG: After push, ${normalizedZone} zone has ${targetZone.length} cards`);
            }
            
        } else if (normalizedZone === ZoneType.BASE) {
            // Base zone
            console.log(`🔍 DEBUG: Placing base card`);
            if (!playerZones.base) playerZones.base = [];
            playerZones.base.push(zoneCard as BaseStructureZoneCard);
            
        } else {
            // Handle pilots and commands in special zones
            if (zoneCard.cardData.cardType === 'pilot') {
                console.log(`🔍 DEBUG: Placing pilot card in pilots zone`);
                if (!playerZones.pilots) playerZones.pilots = [];
                playerZones.pilots.push(zoneCard as PilotZoneCard);
            } else if (zoneCard.cardData.cardType === 'command') {
                console.log(`🔍 DEBUG: Placing command card in commands zone`);
                if (!playerZones.commands) playerZones.commands = [];
                playerZones.commands.push(zoneCard as CommandZoneCard);
            } else {
                console.warn(`⚠️ Unknown zone placement for card type ${zoneCard.cardData.cardType} in zone ${normalizedZone}`);
            }
        }
        
        // Final verification
        const finalPlayerZones = this.getPlayerZones(playerId);
        const finalZoneContent = finalPlayerZones[normalizedZone];
        console.log(`🔍 FINAL DEBUG: After placement, ${normalizedZone} zone contains:`, finalZoneContent);
        
        console.log(`✅ Set card in zone: ${cardUid} (${cardId}) → ${zone} for player ${playerId} with data: ${resolvedCardData.name || 'Unknown'}`);
    }

    /**
     * Enhanced method that accepts resolved card data for proper object creation
     * This should be used when full card data is available
     */
    public setCardInZoneWithData(playerId: string, zone: ZoneType, cardUid: string, cardData: any): void {
        this.setCardInZone(playerId, zone, cardUid, cardData);
    }

    public setLeaderInZone(playerId: string, leaderData: any): void {
        // Convert old-style leaderData to new unified ZoneCard structure
        const cardUid = leaderData.uid
        const cardId = leaderData.id?.split("_")[0] || leaderData.cardId || leaderData.id;
        
        // Ensure leaderData has proper structure for CardData
        const normalizedLeaderData: BaseStructureData = {
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
        
        // Create unified BaseStructureZoneCard using factory function
        const leaderCard = createZoneCard(cardUid, cardId, normalizedLeaderData, playerId) as BaseStructureZoneCard;
        
        const playerZones = this.getPlayerZones(playerId);
        if (!playerZones.leader) playerZones.leader = [];
        playerZones.leader.push(leaderCard);
        
        console.log(`✅ Set leader in zone: ${cardUid} (${cardId}) for player ${playerId} - ${normalizedLeaderData.name}`);
    }

    public getLeaderInZone(playerId: string): BaseStructureZoneCard | null {
        const playerZones = this.getPlayerZones(playerId);
        return playerZones.base?.[0] || null;
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
        
        if (zone === ZoneType.BASE) {
            if (playerZones.base) {
                playerZones.base.length = 0; // Clear the array
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

    public areAllSlotZonesFilled(playerId: string): boolean {
        return this.isZoneOccupied(playerId, ZoneType.SLOT1) &&
               this.isZoneOccupied(playerId, ZoneType.SLOT2) &&
               this.isZoneOccupied(playerId, ZoneType.SLOT3) &&
               this.isZoneOccupied(playerId, ZoneType.SLOT4) &&
               this.isZoneOccupied(playerId, ZoneType.SLOT5) &&
               this.isZoneOccupied(playerId, ZoneType.SLOT6);
    }

    public isBaseZoneFilled(playerId: string): boolean {
        return this.isZoneOccupied(playerId, ZoneType.BASE);
    }

    public getOccupiedSlotCount(playerId: string): number {
        let count = 0;
        const slotZones = [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6];
        slotZones.forEach(zone => {
            if (this.isZoneOccupied(playerId, zone)) count++;
        });
        return count;
    }

    // Backward compatibility methods
    public areAllCharacterZonesFilled(playerId: string): boolean {
        return this.areAllSlotZonesFilled(playerId);
    }

    public isHelpZoneFilled(playerId: string): boolean {
        return this.isBaseZoneFilled(playerId);
    }

    public isSpZoneFilled(playerId: string): boolean {
        return false; // SP zones don't exist in new system
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

// EventManager class removed - now using UnifiedEventManager

export class PlaySequenceManager {
    private sequence: PlaySequence;
    private gameEnv?: GameEnvironment; // Reference to parent GameEnvironment for auto-injection

    constructor(gameEnv?: GameEnvironment) {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
        this.gameEnv = gameEnv;
    }

    /**
     * Add a play action to the sequence
     * @param playerId - ID of the player making the play
     * @param cardUid - Unique card instance identifier (e.g., "c-43_player1_001")
     * @param action - Type of action being performed
     * @param zone - Zone where the card is being played
     * @param effectData - Additional effect data (optional)
     * @param turnNumber - Turn number when this action was performed (optional)
     * @returns The created PlaySequenceAction
     */
    public addPlay(playerId: string, cardUid: string, action: ActionType, zone: ZoneType, effectData?: any, turnNumber?: number): PlaySequenceAction {
        this.sequence.globalSequence++;
        
        const play: PlaySequenceAction = {
            sequenceId: this.sequence.globalSequence,
            playerId,
            cardUid,
            action,
            zone,
            ...(effectData && { effectData }),
            ...(turnNumber !== undefined && { turnNumber })
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
        // Auto-inject turnNumber if not provided and gameEnv is available
        if (action.turnNumber === undefined && this.gameEnv) {
            console.log(`🔧 Auto-injecting turnNumber ${this.gameEnv.currentTurn} for action ${action.sequenceId}`);
            action.turnNumber = this.gameEnv.currentTurn;
        }
        
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
    public eventManager: UnifiedEventManager;
    public playSequenceManager: PlaySequenceManager;
    
    // REMOVED: validationState - using existing fieldEffects as single source of truth
    
    // Legacy compatibility
    public fieldEffects: { [playerId: string]: PlayerFieldEffects };
    public neutralizationHistory: NeutralizationAction[];
    
    // Event system
    public gameEvents?: any[];
    public lastEventId?: number;
    
    // Card selection system - REFACTOR: Consolidated to single field
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
        this.eventManager = new UnifiedEventManager();
        this.playSequenceManager = new PlaySequenceManager(this);
        
        // REMOVED: validationState initialization - using fieldEffects as single source of truth
        
        this.fieldEffects = {};
        this.neutralizationHistory = [];
        
        // Initialize card selection system - REFACTOR: Single field only
        this.pendingCardSelections = {};
        
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

    public placeCardInZone(playerId: string, zone: ZoneType, cardUID: string): boolean {
        // Debug: Log what we're trying to place
        console.log(`🔍 placeCardInZone called: playerId=${playerId}, zone=${zone}, cardUID=${cardUID}`);
        
        // Pass cardUID to setCardInZone
        this.zones.setCardInZone(playerId, zone, cardUID, undefined);
        
        // Debug: Check if placement succeeded
        const playerZones = this.zones.getPlayerZones(playerId);
        const zoneName = zone.toLowerCase() as keyof typeof playerZones;
        console.log(`🔍 After setCardInZone: ${zone} zone contains:`, playerZones[zoneName]);
        
        return true;
    }

    public playCard(playerId: string, cardUid: string, zone: ZoneType): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        // Remove card from hand
        if (!player.playCardFromHand(cardUid)) return false;
        
        // Place card in zone
        this.zones.setCardInZone(playerId, zone, cardUid);
        
        // Determine action type based on card type
        const cardData = this.zones.getCardObjectInZone(playerId, zone);
        let actionType = ActionType.PLAY_UNIT; // default
        
        if (cardData) {
            switch (cardData.cardData.cardType) {
                case 'unit': actionType = ActionType.PLAY_UNIT; break;
                case 'pilot': actionType = ActionType.PLAY_PILOT; break;
                case 'command': actionType = ActionType.PLAY_COMMAND; break;
                case 'base': actionType = ActionType.PLAY_BASE; break;
            }
        }
        
        // Record in play sequence
        this.playSequenceManager.addPlay(playerId, cardUid, actionType, zone, undefined, this.currentTurn);
        
        // Add event
        this.eventManager.addEvent(EventType.CARD_PLAYED, {
            playerId,
            cardUid,
            zone,
            cardType: cardData?.cardData.cardType
        });
        
        return true;
    }

    /**
     * Phase 1: Set leader in zone and record action (basic setup only)
     */
    public setLeaderBasic(playerId: string, leaderUid: string): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        // Step 1: Set card in zone (base zone for leaders/bases)
        this.zones.setCardInZone(playerId, ZoneType.BASE, leaderUid);
        
        // Step 2: Create shared PlaySequenceAction for recording
        const basePlayAction: PlaySequenceAction = {
            sequenceId: this.playSequenceManager.getNextSequenceId(),
            playerId,
            cardUid: leaderUid,
            action: ActionType.PLAY_BASE,
            zone: ZoneType.BASE,
            effectData: {},
            turnNumber: -1 // hardcode to -1 to indicate it is for play a base
        };
        
        // Step 3: Record play in sequence
        this.playSequenceManager.recordAction(basePlayAction);
        
        // Step 4: Initialize fieldEffects if needed
        if (!player.fieldEffects) {
            console.log(`🔧 Initializing fieldEffects for ${playerId}`);
            player.initializeFieldEffects();
        }
        
        console.log(`✅ Base card ${leaderUid} set for ${playerId} (basic setup)`);
        return true;
    }

    /**
     * Phase 2: Process all leader effects and zone restrictions after both leaders are set
     */
    public async processAllLeaderEffects(): Promise<void> {
        console.log(`🎯 Processing leader effects for all players after both leaders are set`);
        
        // Get all recorded PLAY_BASE actions from the play sequence
        const allActions = this.playSequenceManager.getPlays();
        const baseActions = allActions.filter(action => action.action === ActionType.PLAY_BASE);
        
        for (const baseAction of baseActions) {
            const playerId = baseAction.playerId;
            const baseUid = baseAction.cardUid;
            const player = this.getPlayer(playerId);
            
            if (!player || !player.fieldEffects) {
                console.warn(`⚠️ Skipping leader effects for ${playerId} - player or fieldEffects not found`);
                continue;
            }
            
            // Step 1: Process zone compatibility/restrictions
            await this.processBaseZoneRestrictions(playerId, baseUid);
            
            // Step 2: Process base effects (powerBoost, conditions, etc.)
            await this.processBaseEffects(playerId, baseAction);
        }
        
        console.log(`✅ All base effects processed`);
    }

    /**
     * Process zone restrictions for a specific base card
     */
    private async processBaseZoneRestrictions(playerId: string, baseUid: string): Promise<void> {
        const player = this.getPlayer(playerId);
        if (!player?.fieldEffects) return;
        
        try {
            // Get leader card data to access zoneCompatibility
            const baseCardId = leaderUid.split('_')[0]; // Extract card ID from UID
            const CardInfoUtils = CardInfoUtilsSingleton.getInstance();
            const leaderCardData = CardInfoUtils?.getLeaderCards(baseCardId);
            
            if (leaderCardData?.zoneCompatibility) {
                console.log(`🎯 Applying zone restrictions for leader ${baseCardId} (${playerId})`);
                
                // Apply zone compatibility to fieldEffects.zoneRestrictions
                // For the new system, all slots accept all cards by default
                player.fieldEffects.zoneRestrictions = {
                    slot1: 'ALL',
                    slot2: 'ALL', 
                    slot3: 'ALL',
                    slot4: 'ALL',
                    slot5: 'ALL',
                    slot6: 'ALL',
                    base: 'ALL'   // Base zone accepts base cards
                };
                
                console.log(`✅ Zone restrictions applied for ${baseCardId}:`, player.fieldEffects.zoneRestrictions);
            } else {
                console.warn(`⚠️ No zoneCompatibility found for leader ${baseCardId}`);
            }
        } catch (error) {
            console.error(`❌ Error processing zone compatibility for ${leaderUid}:`, error);
        }
    }

    /**
     * Process dynamic effects for a specific leader
     */
    private async processLeaderEffects(playerId: string, leaderAction: PlaySequenceAction): Promise<void> {
        try {
            console.log(`🎯 Processing leader effects for ${leaderAction.cardUid} (${playerId})`);
            // PLACEHOLDER: Process card effects
            console.log('🚧 [PLACEHOLDER] Card effect processing not implemented');
            // TODO: Implement card effect processing logic
            console.log(`✅ Leader effects processed for ${leaderAction.cardUid}`);
        } catch (error) {
            console.error(`❌ Error processing leader effects for ${leaderAction.cardUid}:`, error);
        }
    }

    /**
     * @deprecated Use setLeaderBasic() and processAllLeaderEffects() instead
     * Legacy method - kept for backward compatibility
     */
    public async setLeader(playerId: string, leaderUid: string): Promise<boolean> {
        console.warn(`⚠️ setLeader() is deprecated. Use setLeaderBasic() + processAllLeaderEffects() instead`);
        
        // Phase 1: Basic setup
        const basicResult = this.setLeaderBasic(playerId, leaderUid);
        if (!basicResult) return false;
        
        // Phase 2: Process effects immediately (for backward compatibility)
        await this.processAllLeaderEffects();
        
        return true;
    }

    // ============ VALIDATION METHODS ============

    public areAllMainZonesFilled(): boolean {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.every(playerId => 
            this.zones.areAllSlotZonesFilled(playerId)
        );
    }

    public areAnySlotZonesFilled(): boolean {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.some(playerId => 
            this.zones.getOccupiedSlotCount(playerId) > 0
        );
    }

    public areAllBaseZonesFilled(): boolean {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.every(playerId => this.zones.isBaseZoneFilled(playerId));
    }

    // Backward compatibility
    public areAllSpZonesFilled(): boolean {
        return this.areAllBaseZonesFilled();
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
            
            // Card selection system - REFACTOR: Single field consolidation
            pendingCardSelections: this.pendingCardSelections || {},
            
            // Incremental effect processing
            lastProcessedSequence: this.lastProcessedSequence
        };
        
        // Convert players
        for (const [playerId, player] of Object.entries(this.players)) {
            if (typeof player.toJSON !== 'function') {
                console.error(`❌ Player ${playerId} does not have toJSON method. Type:`, typeof player, 'Constructor:', player.constructor?.name);
                console.error('Player object keys:', Object.keys(player));
                throw new Error(`Player ${playerId} is not a proper Player instance - missing toJSON method`);
            }
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
        gameEnv.eventManager = UnifiedEventManager.fromJSON(data);
        
        // Play sequence
        gameEnv.playSequenceManager = PlaySequenceManager.fromJSON(data.playSequence);
        
        // Legacy compatibility
        gameEnv.fieldEffects = data.fieldEffects || {};
        gameEnv.neutralizationHistory = data.neutralizationHistory || [];
        
        // Incremental effect processing
        gameEnv.lastProcessedSequence = data.lastProcessedSequence || 0;
        
        // Card selection system restoration - REFACTOR: Single field only
        gameEnv.pendingCardSelections = data.pendingCardSelections || {};
      
        
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

    // ============ CARD SELECTION HELPERS ============

    /**
     * Check if there are pending card selections requiring player input
     * Replaces pendingPlayerAction checking logic
     */
    public hasPendingCardSelection(): boolean {
        return !!this.pendingCardSelections && Object.keys(this.pendingCardSelections).length > 0;
    }

    /**
     * Get the first pending selection (for single selection scenarios)
     */
    public getFirstPendingSelection(): { selectionId: string; selectionData: any } | null {
        if (!this.pendingCardSelections || Object.keys(this.pendingCardSelections).length === 0) {
            return null;
        }
        
        const selectionIds = Object.keys(this.pendingCardSelections);
        const selectionId = selectionIds[0];
        return {
            selectionId,
            selectionData: this.pendingCardSelections[selectionId]
        };
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
    PlaySequenceManager,
    GamePhase,
    ZoneType,
    ActionType,
    EventType,
    createGameEnvironment,
    createGameEnvironmentFromJSON,
    CardInfoUtilsSingleton
};