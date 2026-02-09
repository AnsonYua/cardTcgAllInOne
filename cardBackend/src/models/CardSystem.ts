// src/models/CardSystem.ts
// Card system interfaces and utilities for custom trading card game

import * as fs from 'fs';
import * as path from 'path';

import { initializeUnitTurnState } from '../utils/UnitTurnStateUtils';

// ============ CARD DATA INTERFACES ============

// Simplified temporary effect for unit-level storage
export interface TemporaryEffect {
    sourceCarduid: string;              // Card that created this effect
    modifyAP?: number;                  // AP modification (optional)
    modifyHP?: number;                  // HP modification (optional)
    breachValue?: number;               // Breach damage granted (optional)
    grantedKeywords?: string[];         // Keywords granted (optional)
    keywordValues?: Record<string, number>; // Keyword numeric values (optional, e.g. Repair 1)
    allowAttackTarget?: {
        status?: string;
        level?: string;
        ap?: string | number;
        damaged?: boolean;
    };
    preventBattleDamage?: {
        from?: string;
        enemyLevel?: string;
        maxEnemyAp?: number;
    };
    preventEffectDamage?: {
        sourceCardType?: string;
        sourceController?: string;
    };
    duration: string;                   // Effect duration
    appliedTurn: number;                // Which turn this was applied
    appliedBy: string;                  // Which player applied it
    endOnSourceDestroyed?: boolean;     // Remove early if source leaves play
}

export interface ActivationLockEffect {
    kind: 'prevent_set_active_next_turn';
    sourceCarduid: string;
    appliedBy: string;
    appliedTurn: number;
    remainingStartPhases: number;
}

// ✅ CORRECT EffectRule interface matching actual card data structure from st01Card.json
export interface EffectRule {
    effectId: string;
    type: string;
    trigger: string;
    action: string;                 // Direct action property (not nested)
    cost?: {
        [key: string]: any;
    };
    parameters?: {
        [key: string]: any;         // Flexible parameters object
        AP?: number;                // For designate_pilot effects
        HP?: number;                // For designate_pilot effects
        pilotName?: string;         // For designate_pilot effects
        value?: number;             // For other effects
    };
    target?: {
        type?: string;
        scope?: string;
        filters?: any;
        count?: number;
        selection?: {
            type: string;
            tieBreaker?: string;
            [key: string]: any;
        };
    };
    timing?: {
        windows?: string[];
        duration?: string;
        actionTurn?: string;
    };
    conditions?: any[];
    sourceConditions?: any[];
    optional?: boolean;
    description?: string | string[];
}

export interface BasicCardData {
    id?: string;
    name?: string;
    cardType?: string;
    color?: string;
    level?: number;
    cost?: number;
    zone?: string[];             // Array of zone types this card can be played in
    traits?: string[];           // Array of traits for effect targeting
    link?: string[];             // Array of linked pilots/units
    ap?: number;                 // Attack Power
    hp?: number;                 // Health Points
    effects?: {
        description?: string[];
        rules?: EffectRule[];
    };
}

export interface UnitCardData extends BasicCardData {
    cardType: 'unit';
}

export interface PilotCardData extends BasicCardData {
    cardType: 'pilot';
}

export interface CommandCardData extends BasicCardData {
    cardType: 'command';
}


export interface BaseCardData extends BasicCardData {
    cardType: 'base';
}

export interface EnergyCardData extends BasicCardData {
    cardType: 'energy';
}

export interface ShieldCardData extends BasicCardData {
    cardType: 'shield';
}

export type CardData = UnitCardData | PilotCardData | CommandCardData | BaseCardData | EnergyCardData | ShieldCardData;

export interface FieldCardValue {
    totalOriginalAP?: number;
    totalOriginalHP?: number;
    totalTempModifyAP?: number;
    totalTempModifyHP?: number;
    totalContinueModifyAP?: number;
    totalContinueModifyHP?: number;
    totalDamageReceived?: number;
    totalAP?: number;
    totalHP?: number;
}


// ============ ZONE CARD INTERFACES ============

export interface ZoneCard {
    carduid: string;            // Unique game instance ID
    cardId: string;             // Base card ID
    cardData?: CardData;        // Complete card data from JSON (optional for energy cards)
    placedAt?: number;          // Timestamp when placed
    placedBy?: string;          // Player ID who placed card
    isRested?: boolean;         // Whether the card is rested/tapped (common field)
    effectUsage?: Record<string, { lastUsedTurn: number }>; // Track once-per-turn usage
}

export interface UnitZoneCard extends ZoneCard {
    cardData: UnitCardData;  // Required for units
    originalHP?: number;
    originalAP?: number;
    playedThisTurn?: boolean;   // Whether this unit entered play this turn
    canAttackOnPlayTurn?: boolean; // Whether the unit may attack on its play turn
    canAttackThisTurn?: boolean; // Response-only: current attack eligibility
    damageReceived?: number; // Cumulative damage taken this turn

    continueModifyAP?: number;   
    continueModifyHP?: number;   

    // NEW: Temporary effects applied to this unit
    temporaryEffects?: TemporaryEffect[];  // Effects that expire at end of turn

    activationLocks?: ActivationLockEffect[];
}

export interface PilotZoneCard extends ZoneCard {
    cardData: PilotCardData | CommandCardData;  // Allow command cards played as pilots
    originalAP?: number;     // Original Attack Power
    originalHP?: number;     // Original Health Points
    playedAs?: string;       // Track how the card is being played (for command cards played as pilots)
    
    continueModifyAP?: number;   
    continueModifyHP?: number;   
    // NEW: Temporary effects applied to this pilot
    temporaryEffects?: TemporaryEffect[];  // Effects that expire at end of turn
}

export interface CommandZoneCard extends ZoneCard {
    cardData: CommandCardData;  // Required for commands
    isActivated?: boolean;      // Whether the command has been activated
}

export interface BaseCard extends ZoneCard {
    cardData: BaseCardData;  // Required for base structures
    originalHP?: number;
    damageReceived?:number;
    fieldCardValue?:FieldCardValue;
}

export interface EnergyZoneCard extends ZoneCard {
    cardData: EnergyCardData; // Required for energy cards
    isExtraEnergy?: boolean;   // For consumable energy - whether used up
}

export interface ShieldCard extends ZoneCard {
    cardData: ShieldCardData; // Required for shields
    originalCardType?: string; // Preserve original cardType for trash operations
}

// ============ ZONE CARD UTILITIES ============

export function createZoneCard(
    carduid: string,
    cardId: string,
    cardData: CardData,
    placedBy: string = '',
    playAs?: string
): ZoneCard {
    const baseCard: ZoneCard = {
        carduid,
        cardId,
        cardData,
        placedAt: Date.now(),
        placedBy,
        isRested: false,
        effectUsage: {}
    };

    // Priority: playAs parameter overrides cardData.cardType
    const effectiveType = playAs || (cardData as CardData).cardType;
    
    switch (effectiveType) {
        case 'unit':
            const unitCard = {
                ...baseCard,
                cardData: cardData as UnitCardData,
                originalAP: cardData.ap,
                originalHP: cardData.hp,
                isRested: false,
                damageReceived: 0
            } as UnitZoneCard;
            initializeUnitTurnState(unitCard);
            return unitCard;
            
        case 'pilot':
            // Special handling for command cards played as pilots
            if ((cardData as CardData).cardType === 'command' && playAs === 'pilot') {
                console.log(`🎯 Special handling: Command card ${cardId} played as pilot`);
                
                // Extract AP/HP from designate_pilot effect
                let pilotAP = 0;
                let pilotHP = 0;
                
                // ✅ FIXED: Use correct data structure matching actual card data
                const designatePilotEffect = cardData.effects?.rules?.find(rule => 
                    rule.action === 'designate_pilot'
                );
                
                if (designatePilotEffect && designatePilotEffect.parameters) {
                    pilotAP = designatePilotEffect.parameters.AP || 0;
                    pilotHP = designatePilotEffect.parameters.HP || 0;
                    console.log(`🎯 Found designate_pilot effect: AP=${pilotAP}, HP=${pilotHP}`);
                } else {
                    console.warn(`⚠️ No designate_pilot effect found for command card ${cardId}, using defaults`);
                }
                
                return {
                    ...baseCard,
                    originalAP: pilotAP,
                    originalHP: pilotHP,
                    cardData: cardData as CommandCardData, // Keep original command data
                    playedAs: 'pilot', // Track how it's being played
                    originalCardType: (cardData as any)?.originalCardType || cardData.cardType
                } as PilotZoneCard;
            }
            
            return {
                ...baseCard,
                originalAP: cardData.ap,
                originalHP: cardData.hp,
                cardData: cardData as PilotCardData
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
                cardData: cardData as BaseCardData,
                originalHP: cardData?.hp?cardData?.hp:3 ,
                damageReceived: 0,
                isRested: false
            } as BaseCard;
            
        case 'energy':
            return {
                ...baseCard,
                cardData: cardData as EnergyCardData,
                isExtraEnergy: false
            } as EnergyZoneCard;
            
        case 'shield':
            return {
                ...baseCard,
                cardData: cardData as ShieldCardData,
                originalCardType: (cardData as any)?.originalCardType || cardData.cardType
            } as ShieldCard;
            
        default:
            throw new Error(`Unknown effective type: ${effectiveType} (cardType: ${(cardData as CardData).cardType}, playAs: ${playAs})`);
    }
}

// Type guard functions
export function isUnitZoneCard(card: ZoneCard): card is UnitZoneCard {
    return card.cardData?.cardType === 'unit';
}

export function isPilotZoneCard(card: ZoneCard): card is PilotZoneCard {
    return card.cardData?.cardType === 'pilot';
}

export function isCommandZoneCard(card: ZoneCard): card is CommandZoneCard {
    return card.cardData?.cardType === 'command';
}

export function isBaseCard(card: ZoneCard): card is BaseCard {
    return card.cardData?.cardType === 'base';
}

export function isEnergyZoneCard(card: ZoneCard): card is EnergyZoneCard {
    return card.cardData?.cardType === 'energy';
}

export function isShieldCard(card: ZoneCard): card is ShieldCard {
    return card.cardData?.cardType === 'shield';
}

export class ZoneCardUtils {
    static getCardColor(card: ZoneCard): string {
        return card.cardData?.color || 'Unknown';
    }

    static getEffectiveTraits(card: ZoneCard): string[] {
        return card.cardData?.traits || [];
    }

    static getLinkedCards(card: ZoneCard): string[] {
        return card.cardData?.link || [];
    }

    static getValidZones(card: ZoneCard): string[] {
        return card.cardData?.zone || [];
    }

    static canBePlacedInZone(card: ZoneCard, targetZone: string): boolean {
        const validZones = card.cardData?.zone || [];
        return validZones.includes(targetZone) || validZones.includes('Any');
    }

    static canTriggerEffects(card: ZoneCard): boolean {
        return (card.cardData?.effects?.rules?.length || 0) > 0;
    }

    static getCurrentAP(card: ZoneCard): number {
        const baseAP = 'originalAP' in card
            ? (card as UnitZoneCard | PilotZoneCard).originalAP ?? card.cardData?.ap ?? 0
            : card.cardData?.ap ?? 0;
        const continueAP = 'continueModifyAP' in card ? (card as UnitZoneCard | PilotZoneCard).continueModifyAP ?? 0 : 0;
        const temporaryAP = this.sumTemporaryModifier(card, 'modifyAP');
        return baseAP + continueAP + temporaryAP;
    }

    static getCurrentHP(card: ZoneCard): number {
        const baseHP = 'originalHP' in card
            ? (card as UnitZoneCard | PilotZoneCard | BaseCard).originalHP ?? card.cardData?.hp ?? 0
            : card.cardData?.hp ?? 0;
        const continueHP = 'continueModifyHP' in card ? (card as UnitZoneCard | PilotZoneCard).continueModifyHP ?? 0 : 0;
        const temporaryHP = this.sumTemporaryModifier(card, 'modifyHP');
        const damage = isPilotZoneCard(card) ? 0 : (card as UnitZoneCard | BaseCard).damageReceived ?? 0;
        return Math.max(0, baseHP + continueHP + temporaryHP - damage);
    }

    private static sumTemporaryModifier(card: ZoneCard, property: 'modifyAP' | 'modifyHP'): number {
        const legacy = (card as any)[property];
        if (typeof legacy === 'number' && !Number.isNaN(legacy)) {
            return legacy;
        }

        const effects = (card as Partial<UnitZoneCard | PilotZoneCard>).temporaryEffects;
        if (Array.isArray(effects) && effects.length > 0) {
            return effects.reduce((total, effect) => {
                const value = effect[property];
                if (typeof value === 'number' && !Number.isNaN(value)) {
                    return total + value;
                }
                return total;
            }, 0);
        }
        return 0;
    }

    // Note: Pilot-unit pairing now handled implicitly through SlotZone structure
    // No longer need explicit pairing references

    static isRested(card: ZoneCard): boolean {
        return card.isRested || false;
    }

    static getDisplayName(card: ZoneCard): string {
        return card.cardData?.name || card.cardId;
    }

    static getActiveEffects(card: ZoneCard): EffectRule[] {
        return card.cardData?.effects?.rules || [];
    }
}

// ============ OTHER INTERFACES ============

export interface CardMapping {
    [uid: string]: string; // UID to cardId mapping
}

export interface PlayerDeckData {
    hand: string[];
    mainDeck: string[];
}

// ============ CARD DATABASE MANAGEMENT ============

/**
 * CardDatabaseManager handles all card database operations
 * Provides centralized access to card data and database management
 */
export class CardDatabaseManager {
    private static cardDatabase: any = null;
    private static cardIdToSetFolder: Record<string, string> | null = null;

    // Static initialization - load card database on first use
    static {
        CardDatabaseManager.ensureCardDatabaseLoaded();
    }

    /**
     * Load card database into global storage for efficient access
     */
    private static ensureCardDatabaseLoaded(): void {
        if (!CardDatabaseManager.cardDatabase) {
            try {
                const dataDirCandidates = [
                    path.join(__dirname, '../data'),
                    // When running compiled JS (dist), __dirname may be dist/...; fall back to workspace-relative src/data.
                    path.join(process.cwd(), 'src', 'data'),
                    path.join(process.cwd(), 'data')
                ];
                const dataDir = dataDirCandidates.find((candidate) => {
                    try {
                        return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
                    } catch {
                        return false;
                    }
                });

                if (!dataDir) {
                    throw new Error(`Card data directory not found. Tried: ${dataDirCandidates.join(', ')}`);
                }
                const files = fs.readdirSync(dataDir)
                    .filter(filename => /^(st|gd)\d{2}Card\.json$/i.test(filename))
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                const merged: Record<string, any> = {};
                const folderIndex: Record<string, string> = {};

                const collectTokenIdsFromValue = (value: any, tokenIds: Set<string>, visited: Set<any>): void => {
                    if (!value) {
                        return;
                    }
                    if (typeof value === 'string') {
                        if (/^T-\d+$/i.test(value)) {
                            tokenIds.add(value);
                        }
                        return;
                    }
                    if (typeof value !== 'object') {
                        return;
                    }
                    if (visited.has(value)) {
                        return;
                    }
                    visited.add(value);

                    if (Array.isArray(value)) {
                        for (const entry of value) {
                            collectTokenIdsFromValue(entry, tokenIds, visited);
                        }
                        return;
                    }

                    const maybeCardId = (value as any).cardId;
                    const maybeId = (value as any).id;
                    if (typeof maybeCardId === 'string' && /^T-\d+$/i.test(maybeCardId)) {
                        tokenIds.add(maybeCardId);
                    }
                    if (typeof maybeId === 'string' && /^T-\d+$/i.test(maybeId)) {
                        tokenIds.add(maybeId);
                    }

                    for (const child of Object.values(value)) {
                        collectTokenIdsFromValue(child, tokenIds, visited);
                    }
                };

                for (const filename of files) {
                    const cardDataPath = path.join(dataDir, filename);
                    const raw = JSON.parse(fs.readFileSync(cardDataPath, 'utf8'));
                    const cards = raw?.cards || raw;
                    if (!cards || typeof cards !== 'object') {
                        continue;
                    }
                    const folderMatch = filename.match(/^(st|gd)\d{2}/i);
                    const folder = folderMatch ? folderMatch[0].toLowerCase() : null;
                    if (folder) {
                        // Index cardIds by the file/set they came from.
                        for (const cardId of Object.keys(cards)) {
                            if (typeof cardId === 'string' && cardId.length > 0 && !folderIndex[cardId]) {
                                folderIndex[cardId] = folder;
                            }
                        }

                        // Also index token ids referenced by card effects within this file, so we can resolve
                        // token resource paths even when the token definition itself is not present as a top-level card.
                        const tokenIds = new Set<string>();
                        const visited = new Set<any>();
                        for (const cardData of Object.values(cards)) {
                            collectTokenIdsFromValue(cardData, tokenIds, visited);
                        }
                        for (const tokenId of tokenIds) {
                            if (!folderIndex[tokenId]) {
                                folderIndex[tokenId] = folder;
                            }
                        }
                    }
                    Object.assign(merged, cards);
                }

                CardDatabaseManager.cardDatabase = merged;
                CardDatabaseManager.cardIdToSetFolder = folderIndex;
                console.log(`📚 Card database loaded into global storage (${Object.keys(merged).length} cards)`);
            } catch (error) {
                console.error('❌ Failed to load card database:', error);
                CardDatabaseManager.cardDatabase = {};
                CardDatabaseManager.cardIdToSetFolder = {};
            }
        }
    }

    /**
     * Get card details from global card database
     */
    public static getCardDetails(cardId: string): any {
        if (!CardDatabaseManager.cardDatabase) {
            console.warn('⚠️ Card database not loaded');
            return null;
        }
        return CardDatabaseManager.cardDatabase[cardId] || null;
    }

    /**
     * Best-effort: return the set folder (e.g. "st01", "gd03") that a cardId was loaded from.
     * Useful for tokens (T-xxx) which do not encode their set in the id.
     */
    public static getSetFolderForCardId(cardId: string): string | null {
        if (!CardDatabaseManager.cardIdToSetFolder) {
            return null;
        }
        const folder = CardDatabaseManager.cardIdToSetFolder[cardId];
        return typeof folder === 'string' && folder.length > 0 ? folder : null;
    }

    /**
     * Get card details from global card database
     */
    public static getCardDetailsFromCarduid(carduid: string): any {
         const cardId = carduid.split('_')[0];
        if (!CardDatabaseManager.cardDatabase) {
            console.warn('⚠️ Card database not loaded');
            return null;
        }
        return CardDatabaseManager.cardDatabase[cardId] || null;
    }


    /**
     * Check if card exists in database
     */
    public static cardExists(cardId: string): boolean {
        return !!CardDatabaseManager.getCardDetails(cardId);
    }

    /**
     * Get all cards from database
     */
    public static getAllCards(): any {
        if (!CardDatabaseManager.cardDatabase) {
            console.warn('⚠️ Card database not loaded');
            return {};
        }
        return CardDatabaseManager.cardDatabase;
    }

    /**
     * Get cards by type
     */
    public static getCardsByType(cardType: string): any[] {
        const allCards = CardDatabaseManager.getAllCards();
        return Object.values(allCards).filter((card: any) => card.cardType === cardType);
    }

    /**
     * Search cards by criteria
     */
    public static searchCards(criteria: {
        cardType?: string;
        name?: string;
        traits?: string[];
        ap?: number;
        hp?: number;
    }): any[] {
        const allCards = CardDatabaseManager.getAllCards();
        return Object.values(allCards).filter((card: any) => {
            if (criteria.cardType && card.cardType !== criteria.cardType) return false;
            if (criteria.name && !card.name?.includes(criteria.name)) return false;
            if (criteria.traits && !criteria.traits.some(trait => card.traits?.includes(trait))) return false;
            if (criteria.ap !== undefined && card.ap !== criteria.ap) return false;
            if (criteria.hp !== undefined && card.hp !== criteria.hp) return false;
            return true;
        });
    }

    /**
     * Reload card database (useful for testing or dynamic updates)
     */
    public static reloadDatabase(): void {
        CardDatabaseManager.cardDatabase = null;
        CardDatabaseManager.cardIdToSetFolder = null;
        CardDatabaseManager.ensureCardDatabaseLoaded();
    }

    /**
     * Get database statistics
     */
    public static getDatabaseStats(): {
        totalCards: number;
        cardTypes: { [type: string]: number };
    } {
        const allCards = CardDatabaseManager.getAllCards();
        const cardArray = Object.values(allCards);
        
        const cardTypes: { [type: string]: number } = {};
        cardArray.forEach((card: any) => {
            const type = card.cardType || 'unknown';
            cardTypes[type] = (cardTypes[type] || 0) + 1;
        });

        return {
            totalCards: cardArray.length,
            cardTypes
        };
    }
}
