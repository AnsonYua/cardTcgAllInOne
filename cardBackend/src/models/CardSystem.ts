// src/models/CardSystem.ts
// Card system interfaces and utilities for custom trading card game

import * as fs from 'fs';
import * as path from 'path';


// ============ CARD DATA INTERFACES ============

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

// ============ ZONE CARD INTERFACES ============

export interface ZoneCard {
    cardUid: string;            // Unique game instance ID
    cardId: string;             // Base card ID
    cardData?: CardData;        // Complete card data from JSON (optional for energy cards)
    placedAt?: number;          // Timestamp when placed
    placedBy?: string;          // Player ID who placed card
    isRested?: boolean;         // Whether the card is rested/tapped (common field)
}

export interface UnitZoneCard extends ZoneCard {
    cardData: UnitCardData;  // Required for units
    currentAP?: number;      // Current Attack Power after modifiers (DEPRECATED - use modifyAP)
    currentHP?: number;      // Current Health Points after damage (DEPRECATED - use modifyHP)
    originalHP?: number;
    originalAP?: number;
    isFirstPlay?: boolean;   // Whether this is the unit's first turn on field
    damageReceived?: number; // Cumulative damage taken this turn
    
    // NEW: Effect modifications (added to base stats for final calculation)
    modifyAP?: number;       // AP bonus/penalty from effects (default: 0)
    modifyHP?: number;       // HP bonus/penalty from effects (default: 0)
}

export interface PilotZoneCard extends ZoneCard {
    cardData: PilotCardData | CommandCardData;  // Allow command cards played as pilots
    currentAP?: number;      // Current Attack Power (DEPRECATED - use modifyAP)
    currentHP?: number;      // Current Health Points (DEPRECATED - use modifyHP)
    originalAP?: number;     // Original Attack Power
    originalHP?: number;     // Original Health Points
    playedAs?: string;       // Track how the card is being played (for command cards played as pilots)
    
    // NEW: Effect modifications (added to base stats for final calculation)
    modifyAP?: number;       // AP bonus/penalty from effects (default: 0)
    modifyHP?: number;       // HP bonus/penalty from effects (default: 0)
}

export interface CommandZoneCard extends ZoneCard {
    cardData: CommandCardData;  // Required for commands
    isActivated?: boolean;      // Whether the command has been activated
}

export interface BaseCard extends ZoneCard {
    cardData: BaseCardData;  // Required for base structures
    currentHP?: number; 
    originalHP?: number;
    damageReceived?:number;
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
    cardUid: string,
    cardId: string,
    cardData: CardData,
    placedBy: string = '',
    playAs?: string
): ZoneCard {
    const baseCard: ZoneCard = {
        cardUid,
        cardId,
        cardData,
        placedAt: Date.now(),
        placedBy,
        isRested: false
    };

    // Priority: playAs parameter overrides cardData.cardType
    const effectiveType = playAs || (cardData as CardData).cardType;
    
    switch (effectiveType) {
        case 'unit':
            return {
                ...baseCard,
                cardData: cardData as UnitCardData,
                currentAP: cardData.ap,
                currentHP: cardData.hp,
                originalAP: cardData.ap,
                originalHP: cardData.hp,
                isRested: false,
                isFirstPlay: true,
                damageReceived: 0,
                modifyAP: 0,    // NEW: Initialize effect modifications
                modifyHP: 0     // NEW: Initialize effect modifications
            } as UnitZoneCard;
            
        case 'pilot':
            // Special handling for command cards played as pilots
            if ((cardData as CardData).cardType === 'command' && playAs === 'pilot') {
                console.log(`🎯 Special handling: Command card ${cardId} played as pilot`);
                
                // Extract AP/HP from designate_pilot effect
                let pilotAP = 0;
                let pilotHP = 0;
                
                const designatePilotEffect = cardData.effects?.rules?.find(rule => 
                    rule.effect?.action === 'designate_pilot'
                );
                
                if (designatePilotEffect && designatePilotEffect.effect?.parameters) {
                    pilotAP = designatePilotEffect.effect.parameters.AP || 0;
                    pilotHP = designatePilotEffect.effect.parameters.HP || 0;
                    console.log(`🎯 Found designate_pilot effect: AP=${pilotAP}, HP=${pilotHP}`);
                } else {
                    console.warn(`⚠️ No designate_pilot effect found for command card ${cardId}, using defaults`);
                }
                
                return {
                    ...baseCard,
                    currentAP: pilotAP,
                    currentHP: pilotHP,
                    originalAP: pilotAP,
                    originalHP: pilotHP,
                    cardData: cardData as CommandCardData, // Keep original command data
                    playedAs: 'pilot', // Track how it's being played
                    originalCardType: (cardData as any)?.originalCardType || cardData.cardType,
                    modifyAP: 0,    // NEW: Initialize effect modifications
                    modifyHP: 0     // NEW: Initialize effect modifications
                } as PilotZoneCard;
            }
            
            return {
                ...baseCard,
                currentAP: cardData.ap,
                currentHP: cardData.hp,
                originalAP: cardData.ap,
                originalHP: cardData.hp,
                cardData: cardData as PilotCardData,
                modifyAP: 0,    // NEW: Initialize effect modifications
                modifyHP: 0     // NEW: Initialize effect modifications
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
                currentHP: cardData?.hp?cardData?.hp:3,
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
        if (isUnitZoneCard(card)) {
            return card.currentAP || card.cardData?.ap || 0;
        }
        return card.cardData?.ap || 0;
    }

    static getCurrentHP(card: ZoneCard): number {
        if (isUnitZoneCard(card)) {
            return card.currentHP || card.cardData?.hp || 0;
        }
        return card.cardData?.hp || 0;
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
                const cardDataPath = path.join(__dirname, '../data/st01Card.json');
                const cardFileData = JSON.parse(fs.readFileSync(cardDataPath, 'utf8'));
                // Extract cards from nested structure
                CardDatabaseManager.cardDatabase = cardFileData.cards || cardFileData;
                console.log('📚 Card database loaded into global storage');
            } catch (error) {
                console.error('❌ Failed to load card database:', error);
                CardDatabaseManager.cardDatabase = {};
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